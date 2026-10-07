import { randomUUID } from 'node:crypto';
import { assetIdentifierTypeSchema, type AssetIdentifier, type UnitStatus } from '@ee/contracts';
import {
  IDENTIFIER_CONSTRAINT,
  YARD_NAME_CONSTRAINT,
  type FleetRepository,
  type UnitFields,
  type UnitFilters,
  type UnitPatch,
  type UnitView,
  type YardFields,
  type YardUnitCounts,
  type YardView,
} from '../domain';

export interface SeedCity {
  id: string;
  geoId: string;
  name: string;
  enabled: boolean;
}

export interface SeedListing {
  id: string;
  supplierProfileId: string;
  title: string;
  model: { id: string; modelName: string; manufacturer: { id: string; name: string } };
}

export interface SeedProfile {
  id: string;
  accountId: string;
}

interface StoredYard extends YardFields {
  id: string;
  supplierProfileId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredUnit extends UnitFields {
  id: string;
  supplierProfileId: string;
  status: UnitStatus;
  identifiers: AssetIdentifier[];
  createdAt: Date;
  updatedAt: Date;
}

/** Postgres orders enum values by declaration, so identifiers come back in this order. */
const typeOrder = assetIdentifierTypeSchema.options;

/** Shaped like a pg error so `findPgError` maps it the same way as a real one. */
function uniqueViolation(constraint: string): Error {
  return Object.assign(new Error(`duplicate key violates ${constraint}`), {
    code: '23505',
    constraint,
  });
}

export class InMemoryFleetRepository implements FleetRepository {
  readonly cities: SeedCity[] = [];
  readonly listings: SeedListing[] = [];
  readonly profiles: SeedProfile[] = [];
  private readonly yards: StoredYard[] = [];
  private readonly units: StoredUnit[] = [];

  findSupplierProfileId(accountId: string): Promise<string | null> {
    return Promise.resolve(this.profiles.find((p) => p.accountId === accountId)?.id ?? null);
  }

  findEnabledCityId(geoId: string): Promise<string | null> {
    return Promise.resolve(this.cities.find((c) => c.geoId === geoId && c.enabled)?.id ?? null);
  }

  listingBelongsTo(listingId: string, supplierProfileId: string): Promise<boolean> {
    return Promise.resolve(
      this.listings.some((l) => l.id === listingId && l.supplierProfileId === supplierProfileId),
    );
  }

  createYard(supplierProfileId: string, fields: YardFields, now: Date): Promise<string> {
    this.assertYardNameFree(supplierProfileId, fields.name);
    const id = randomUUID();
    this.yards.push({ ...fields, id, supplierProfileId, createdAt: now, updatedAt: now });
    return Promise.resolve(id);
  }

  updateYard(
    id: string,
    supplierProfileId: string,
    patch: Partial<YardFields>,
    updatedAt: Date,
  ): Promise<boolean> {
    const yard = this.ownedYard(id, supplierProfileId);
    if (!yard) return Promise.resolve(false);
    if (patch.name !== undefined) this.assertYardNameFree(supplierProfileId, patch.name, id);
    Object.assign(yard, patch, { updatedAt });
    return Promise.resolve(true);
  }

  deleteYard(id: string, supplierProfileId: string): Promise<boolean> {
    const index = this.yards.findIndex(
      (y) => y.id === id && y.supplierProfileId === supplierProfileId,
    );
    if (index === -1) return Promise.resolve(false);
    // Mirrors ON DELETE RESTRICT on equipment_units.yard_id.
    if (this.units.some((u) => u.yardId === id)) {
      return Promise.reject(Object.assign(new Error('restrict'), { code: '23503' }));
    }
    this.yards.splice(index, 1);
    return Promise.resolve(true);
  }

  findYard(id: string, supplierProfileId: string): Promise<YardView | null> {
    const yard = this.ownedYard(id, supplierProfileId);
    return Promise.resolve(yard ? this.toYardView(yard) : null);
  }

  listYards(supplierProfileId: string): Promise<YardView[]> {
    return Promise.resolve(
      this.yards
        .filter((y) => y.supplierProfileId === supplierProfileId)
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map((y) => this.toYardView(y)),
    );
  }

  countUnitsInYard(yardId: string): Promise<YardUnitCounts> {
    const inYard = this.units.filter((u) => u.yardId === yardId);
    return Promise.resolve({
      active: inYard.filter((u) => u.status === 'ACTIVE').length,
      retired: inYard.filter((u) => u.status === 'RETIRED').length,
    });
  }

  createUnit(
    supplierProfileId: string,
    fields: UnitFields,
    identifiers: AssetIdentifier[],
    now: Date,
  ): Promise<string> {
    this.assertIdentifiersFree(supplierProfileId, identifiers);
    const id = randomUUID();
    this.units.push({
      ...fields,
      id,
      supplierProfileId,
      status: 'ACTIVE',
      identifiers: identifiers.map((i) => ({ ...i })),
      createdAt: now,
      updatedAt: now,
    });
    return Promise.resolve(id);
  }

  updateUnit(
    id: string,
    supplierProfileId: string,
    patch: UnitPatch,
    updatedAt: Date,
  ): Promise<boolean> {
    const unit = this.ownedUnit(id, supplierProfileId);
    if (!unit || unit.status !== 'ACTIVE') return Promise.resolve(false);
    const { identifiers, ...fields } = patch;
    if (identifiers !== undefined) {
      this.assertIdentifiersFree(supplierProfileId, identifiers, id);
      unit.identifiers = identifiers.map((i) => ({ ...i }));
    }
    Object.assign(unit, fields, { updatedAt });
    return Promise.resolve(true);
  }

  retireUnit(id: string, supplierProfileId: string, updatedAt: Date): Promise<boolean> {
    const unit = this.ownedUnit(id, supplierProfileId);
    if (!unit || unit.status !== 'ACTIVE') return Promise.resolve(false);
    unit.status = 'RETIRED';
    unit.updatedAt = updatedAt;
    return Promise.resolve(true);
  }

  findUnit(id: string, supplierProfileId: string): Promise<UnitView | null> {
    const unit = this.ownedUnit(id, supplierProfileId);
    return Promise.resolve(unit ? this.toUnitView(unit) : null);
  }

  listUnits(supplierProfileId: string, filters: UnitFilters): Promise<UnitView[]> {
    return Promise.resolve(
      this.units
        .filter(
          (u) =>
            u.supplierProfileId === supplierProfileId &&
            (filters.listingId === undefined || u.listingId === filters.listingId) &&
            (filters.yardId === undefined || u.yardId === filters.yardId) &&
            (filters.status === undefined || u.status === filters.status),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
        .map((u) => this.toUnitView(u)),
    );
  }

  countActiveUnitsForListing(listingId: string): Promise<number> {
    return Promise.resolve(this.activeUnitsFor(listingId));
  }

  /** Synchronous count, for plugging into the listings repository in tests. */
  activeUnitsFor = (listingId: string): number => this.activeUnitIdsFor(listingId).length;

  /** For plugging into the availability repository in tests. */
  activeUnitIdsFor = (listingId: string): string[] =>
    this.units.filter((u) => u.listingId === listingId && u.status === 'ACTIVE').map((u) => u.id);

  private assertYardNameFree(supplierProfileId: string, name: string, exceptId?: string): void {
    const taken = this.yards.some(
      (y) =>
        y.supplierProfileId === supplierProfileId &&
        y.id !== exceptId &&
        y.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) throw uniqueViolation(YARD_NAME_CONSTRAINT);
  }

  private assertIdentifiersFree(
    supplierProfileId: string,
    identifiers: AssetIdentifier[],
    exceptUnitId?: string,
  ): void {
    const taken = identifiers.some((wanted) =>
      this.units.some(
        (u) =>
          u.supplierProfileId === supplierProfileId &&
          u.id !== exceptUnitId &&
          u.identifiers.some(
            (i) => i.type === wanted.type && i.value.toLowerCase() === wanted.value.toLowerCase(),
          ),
      ),
    );
    if (taken) throw uniqueViolation(IDENTIFIER_CONSTRAINT);
  }

  private ownedYard(id: string, supplierProfileId: string): StoredYard | undefined {
    return this.yards.find((y) => y.id === id && y.supplierProfileId === supplierProfileId);
  }

  private ownedUnit(id: string, supplierProfileId: string): StoredUnit | undefined {
    return this.units.find((u) => u.id === id && u.supplierProfileId === supplierProfileId);
  }

  private toYardView(yard: StoredYard): YardView {
    const city = this.cities.find((c) => c.id === yard.cityId)!;
    return {
      id: yard.id,
      supplierProfileId: yard.supplierProfileId,
      name: yard.name,
      city: { geoId: city.geoId, name: city.name },
      address: yard.address,
      createdAt: yard.createdAt,
      updatedAt: yard.updatedAt,
    };
  }

  private toUnitView(unit: StoredUnit): UnitView {
    const listing = this.listings.find((l) => l.id === unit.listingId)!;
    const yard = this.toYardView(this.yards.find((y) => y.id === unit.yardId)!);
    return {
      id: unit.id,
      supplierProfileId: unit.supplierProfileId,
      listing: { id: listing.id, title: listing.title },
      model: {
        id: listing.model.id,
        modelName: listing.model.modelName,
        manufacturer: { ...listing.model.manufacturer },
      },
      yard: { id: yard.id, name: yard.name, city: yard.city },
      modelYear: unit.modelYear,
      condition: unit.condition,
      label: unit.label,
      status: unit.status,
      identifiers: [...unit.identifiers]
        .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type))
        .map((i) => ({ ...i })),
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }
}
