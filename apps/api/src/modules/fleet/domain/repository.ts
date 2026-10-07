import type { AssetIdentifier } from '@ee/contracts';
import type {
  UnitFields,
  UnitFilters,
  UnitPatch,
  UnitView,
  YardFields,
  YardUnitCounts,
  YardView,
} from './fleet';

export const FLEET_REPOSITORY = Symbol('FLEET_REPOSITORY');

/**
 * Every supplier-facing method is scoped by `supplierProfileId`; another supplier's ids
 * behave exactly like unknown ids (`null` / `false`).
 */
export interface FleetRepository {
  findSupplierProfileId(accountId: string): Promise<string | null>;
  findEnabledCityId(geoId: string): Promise<string | null>;
  listingBelongsTo(listingId: string, supplierProfileId: string): Promise<boolean>;

  createYard(supplierProfileId: string, fields: YardFields, now: Date): Promise<string>;
  updateYard(
    id: string,
    supplierProfileId: string,
    patch: Partial<YardFields>,
    updatedAt: Date,
  ): Promise<boolean>;
  deleteYard(id: string, supplierProfileId: string): Promise<boolean>;
  findYard(id: string, supplierProfileId: string): Promise<YardView | null>;
  listYards(supplierProfileId: string): Promise<YardView[]>;
  countUnitsInYard(yardId: string): Promise<YardUnitCounts>;

  /** Inserts the unit and its identifiers atomically. */
  createUnit(
    supplierProfileId: string,
    fields: UnitFields,
    identifiers: AssetIdentifier[],
    now: Date,
  ): Promise<string>;
  /** Updates an ACTIVE unit (and replaces identifiers when given); `false` if none matched. */
  updateUnit(
    id: string,
    supplierProfileId: string,
    patch: UnitPatch,
    updatedAt: Date,
  ): Promise<boolean>;
  /** Compare-and-set ACTIVE → RETIRED. */
  retireUnit(id: string, supplierProfileId: string, updatedAt: Date): Promise<boolean>;
  findUnit(id: string, supplierProfileId: string): Promise<UnitView | null>;
  listUnits(supplierProfileId: string, filters: UnitFilters): Promise<UnitView[]>;
  countActiveUnitsForListing(listingId: string): Promise<number>;
}
