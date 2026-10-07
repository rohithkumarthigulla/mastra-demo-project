import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import {
  equipmentListings,
  equipmentUnits,
  maintenanceBlocks,
} from '../../../platform/database/schema';
import type { AvailabilityRepository, BlockFields, BlockView, TimeRange } from '../domain';

const overlapping = (range: TimeRange) =>
  and(lt(maintenanceBlocks.startAt, range.end), gt(maintenanceBlocks.endAt, range.start));

@Injectable()
export class DrizzleAvailabilityRepository implements AvailabilityRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findPublicListingUnitIds(listingId: string): Promise<string[] | null> {
    const [listing] = await this.db
      .select({ id: equipmentListings.id })
      .from(equipmentListings)
      .where(and(eq(equipmentListings.id, listingId), eq(equipmentListings.status, 'ACTIVE')))
      .limit(1);
    if (!listing) return null;
    const units = await this.db
      .select({ id: equipmentUnits.id })
      .from(equipmentUnits)
      .where(and(eq(equipmentUnits.listingId, listingId), eq(equipmentUnits.status, 'ACTIVE')));
    return units.map((u) => u.id);
  }

  async hasActiveOverlap(unitId: string, range: TimeRange): Promise<boolean> {
    const rows = await this.db
      .select({ id: maintenanceBlocks.id })
      .from(maintenanceBlocks)
      .where(
        and(
          eq(maintenanceBlocks.unitId, unitId),
          eq(maintenanceBlocks.status, 'ACTIVE'),
          overlapping(range),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async createBlock(fields: BlockFields, now: Date): Promise<BlockView> {
    const [row] = await this.db
      .insert(maintenanceBlocks)
      .values({ ...fields, createdAt: now, updatedAt: now })
      .returning();
    return row!;
  }

  async findBlock(id: string): Promise<BlockView | null> {
    const [row] = await this.db
      .select()
      .from(maintenanceBlocks)
      .where(eq(maintenanceBlocks.id, id))
      .limit(1);
    return row ?? null;
  }

  async liftBlock(id: string, now: Date): Promise<boolean> {
    const rows = await this.db
      .update(maintenanceBlocks)
      .set({ status: 'LIFTED', updatedAt: now })
      .where(and(eq(maintenanceBlocks.id, id), eq(maintenanceBlocks.status, 'ACTIVE')))
      .returning({ id: maintenanceBlocks.id });
    return rows.length > 0;
  }

  listActiveBlocks(unitIds: string[], range: TimeRange): Promise<BlockView[]> {
    return this.db
      .select()
      .from(maintenanceBlocks)
      .where(
        and(
          inArray(maintenanceBlocks.unitId, unitIds),
          eq(maintenanceBlocks.status, 'ACTIVE'),
          overlapping(range),
        ),
      )
      .orderBy(asc(maintenanceBlocks.startAt), asc(maintenanceBlocks.id));
  }
}
