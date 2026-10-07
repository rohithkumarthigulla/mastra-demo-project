import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateUnitRequest,
  CreateYardRequest,
  ListUnitsQuery,
  UpdateUnitRequest,
  UpdateYardRequest,
} from '@ee/contracts';
import { CLOCK, type Clock } from '../../../platform/auth';
import { findPgError } from '../../../platform/database';
import {
  DuplicateIdentifierError,
  FLEET_REPOSITORY,
  FleetInvalidCityError,
  FleetProfileRequiredError,
  IDENTIFIER_CONSTRAINT,
  UnitListingNotFoundError,
  UnitNotFoundError,
  UnitRetiredError,
  YARD_NAME_CONSTRAINT,
  YardHasActiveUnitsError,
  YardInUseError,
  YardNameTakenError,
  YardNotFoundError,
  type FleetRepository,
  type UnitView,
  type YardFields,
  type YardView,
} from '../domain';

@Injectable()
export class FleetService {
  constructor(
    @Inject(FLEET_REPOSITORY) private readonly fleet: FleetRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async requireProfile(accountId: string): Promise<string> {
    const profileId = await this.fleet.findSupplierProfileId(accountId);
    if (!profileId) throw new FleetProfileRequiredError();
    return profileId;
  }

  async listYards(accountId: string): Promise<YardView[]> {
    return this.fleet.listYards(await this.requireProfile(accountId));
  }

  async createYard(accountId: string, request: CreateYardRequest): Promise<YardView> {
    const profileId = await this.requireProfile(accountId);
    const { cityGeoId, ...rest } = request;
    const fields: YardFields = { ...rest, cityId: await this.resolveCity(cityGeoId) };
    const id = await this.mapConflicts(() =>
      this.fleet.createYard(profileId, fields, this.clock.now()),
    );
    return this.getYard(profileId, id);
  }

  async updateYard(accountId: string, id: string, request: UpdateYardRequest): Promise<YardView> {
    const profileId = await this.requireProfile(accountId);
    const { cityGeoId, ...rest } = request;
    const patch: Partial<YardFields> = { ...rest };
    if (cityGeoId !== undefined) patch.cityId = await this.resolveCity(cityGeoId);
    const updated = await this.mapConflicts(() =>
      this.fleet.updateYard(id, profileId, patch, this.clock.now()),
    );
    if (!updated) throw new YardNotFoundError();
    return this.getYard(profileId, id);
  }

  async deleteYard(accountId: string, id: string): Promise<void> {
    const profileId = await this.requireProfile(accountId);
    if (!(await this.fleet.findYard(id, profileId))) throw new YardNotFoundError();
    const units = await this.fleet.countUnitsInYard(id);
    if (units.active > 0) throw new YardHasActiveUnitsError();
    if (units.retired > 0) throw new YardInUseError();
    if (!(await this.fleet.deleteYard(id, profileId))) throw new YardNotFoundError();
  }

  async listUnits(accountId: string, query: ListUnitsQuery): Promise<UnitView[]> {
    return this.fleet.listUnits(await this.requireProfile(accountId), query);
  }

  async getUnit(accountId: string, id: string): Promise<UnitView> {
    return this.requireUnit(await this.requireProfile(accountId), id);
  }

  async createUnit(accountId: string, request: CreateUnitRequest): Promise<UnitView> {
    const profileId = await this.requireProfile(accountId);
    const { identifiers, label, ...rest } = request;
    if (!(await this.fleet.listingBelongsTo(rest.listingId, profileId))) {
      throw new UnitListingNotFoundError();
    }
    await this.requireYardOf(profileId, rest.yardId);
    const id = await this.mapConflicts(() =>
      this.fleet.createUnit(
        profileId,
        { ...rest, label: label ?? null },
        identifiers,
        this.clock.now(),
      ),
    );
    return this.requireUnit(profileId, id);
  }

  async updateUnit(accountId: string, id: string, request: UpdateUnitRequest): Promise<UnitView> {
    const profileId = await this.requireProfile(accountId);
    const current = await this.requireUnit(profileId, id);
    if (current.status === 'RETIRED') throw new UnitRetiredError();
    if (request.yardId !== undefined) await this.requireYardOf(profileId, request.yardId);
    const updated = await this.mapConflicts(() =>
      this.fleet.updateUnit(id, profileId, request, this.clock.now()),
    );
    // The unit was retired between our read and write.
    if (!updated) throw new UnitRetiredError();
    return this.requireUnit(profileId, id);
  }

  async retireUnit(accountId: string, id: string): Promise<UnitView> {
    const profileId = await this.requireProfile(accountId);
    await this.requireUnit(profileId, id);
    if (!(await this.fleet.retireUnit(id, profileId, this.clock.now()))) {
      throw new UnitRetiredError();
    }
    return this.requireUnit(profileId, id);
  }

  countActiveUnitsForListing(listingId: string): Promise<number> {
    return this.fleet.countActiveUnitsForListing(listingId);
  }

  private async getYard(profileId: string, id: string): Promise<YardView> {
    const yard = await this.fleet.findYard(id, profileId);
    if (!yard) throw new YardNotFoundError();
    return yard;
  }

  private async requireYardOf(profileId: string, yardId: string): Promise<void> {
    if (!(await this.fleet.findYard(yardId, profileId))) throw new YardNotFoundError();
  }

  private async requireUnit(profileId: string, id: string): Promise<UnitView> {
    const unit = await this.fleet.findUnit(id, profileId);
    if (!unit) throw new UnitNotFoundError();
    return unit;
  }

  private async resolveCity(geoId: string): Promise<string> {
    const cityId = await this.fleet.findEnabledCityId(geoId);
    if (!cityId) throw new FleetInvalidCityError();
    return cityId;
  }

  private async mapConflicts<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      const constraint = findPgError(error, '23505')?.constraint;
      if (constraint === YARD_NAME_CONSTRAINT) throw new YardNameTakenError();
      if (constraint === IDENTIFIER_CONSTRAINT) throw new DuplicateIdentifierError();
      throw error;
    }
  }
}
