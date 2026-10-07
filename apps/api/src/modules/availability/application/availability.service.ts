import { Inject, Injectable } from '@nestjs/common';
import type { CreateBlockRequest } from '@ee/contracts';
import { CLOCK, type Clock } from '../../../platform/auth';
import { isExclusionViolation } from '../../../platform/database';
import { FleetService } from '../../fleet/application';
import { UnitNotFoundError, UnitRetiredError, type UnitView } from '../../fleet/domain';
import {
  AVAILABILITY_REPOSITORY,
  BlockAlreadyLiftedError,
  BlockNotFoundError,
  BlockOverlapError,
  PublicListingNotFoundError,
  assertBlockNotInPast,
  type AvailabilityRepository,
  type BlockView,
  type TimeRange,
} from '../domain';

export interface UnitCalendar {
  unit: UnitView;
  range: TimeRange;
  blocks: BlockView[];
}

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(AVAILABILITY_REPOSITORY) private readonly repo: AvailabilityRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly fleet: FleetService,
  ) {}

  async createBlock(
    accountId: string,
    unitId: string,
    request: CreateBlockRequest,
  ): Promise<BlockView> {
    const unit = await this.fleet.getUnit(accountId, unitId);
    if (unit.status !== 'ACTIVE') throw new UnitRetiredError();
    const range = { start: new Date(request.startAt), end: new Date(request.endAt) };
    const now = this.clock.now();
    assertBlockNotInPast(range.start, now);
    if (await this.repo.hasActiveOverlap(unit.id, range)) throw new BlockOverlapError();
    try {
      return await this.repo.createBlock(
        {
          unitId: unit.id,
          reason: request.reason,
          startAt: range.start,
          endAt: range.end,
          note: request.note ?? null,
          createdBy: accountId,
        },
        now,
      );
    } catch (error) {
      // A concurrent request won between the pre-check and the insert.
      if (isExclusionViolation(error)) throw new BlockOverlapError();
      throw error;
    }
  }

  /** Lifting keeps the block for history and frees the time. */
  async liftBlock(accountId: string, blockId: string): Promise<BlockView> {
    const block = await this.ownedBlock(accountId, blockId);
    if (!(await this.repo.liftBlock(block.id, this.clock.now()))) {
      throw new BlockAlreadyLiftedError();
    }
    return (await this.repo.findBlock(block.id)) as BlockView;
  }

  async unitCalendar(accountId: string, unitId: string, range: TimeRange): Promise<UnitCalendar> {
    const unit = await this.fleet.getUnit(accountId, unitId);
    return { unit, range, blocks: await this.busyIntervals([unit.id], range) };
  }

  /** One lane per ACTIVE unit of the supplier. */
  async fleetCalendar(accountId: string, range: TimeRange): Promise<UnitCalendar[]> {
    const units = await this.fleet.listUnits(accountId, { status: 'ACTIVE' });
    const blocks = await this.busyIntervals(
      units.map((u) => u.id),
      range,
    );
    return units.map((unit) => ({
      unit,
      range,
      blocks: blocks.filter((b) => b.unitId === unit.id),
    }));
  }

  async listingAvailability(
    listingId: string,
    range: TimeRange,
  ): Promise<{ totalUnits: number; availableUnits: number }> {
    const unitIds = await this.repo.findPublicListingUnitIds(listingId);
    if (!unitIds) throw new PublicListingNotFoundError();
    const busy = new Set((await this.busyIntervals(unitIds, range)).map((b) => b.unitId));
    return { totalUnits: unitIds.length, availableUnits: unitIds.length - busy.size };
  }

  /**
   * Everything that makes a unit unavailable in `range`. A unit is available iff it is
   * ACTIVE and nothing here overlaps; bookings will join maintenance blocks here.
   */
  private busyIntervals(unitIds: string[], range: TimeRange): Promise<BlockView[]> {
    if (unitIds.length === 0) return Promise.resolve([]);
    return this.repo.listActiveBlocks(unitIds, range);
  }

  private async ownedBlock(accountId: string, blockId: string): Promise<BlockView> {
    const block = await this.repo.findBlock(blockId);
    if (!block) throw new BlockNotFoundError();
    try {
      await this.fleet.getUnit(accountId, block.unitId);
    } catch (error) {
      if (error instanceof UnitNotFoundError) throw new BlockNotFoundError();
      throw error;
    }
    return block;
  }
}
