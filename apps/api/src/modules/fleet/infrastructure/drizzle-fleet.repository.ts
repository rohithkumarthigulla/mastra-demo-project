import { Inject, Injectable } from '@nestjs/common';
import type { AssetIdentifier } from '@ee/contracts';
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import {
  assetIdentifiers,
  cities,
  equipmentListings,
  equipmentModels,
  equipmentUnits,
  manufacturers,
  supplierProfiles,
  yards,
} from '../../../platform/database/schema';
import type {
  FleetRepository,
  UnitFields,
  UnitFilters,
  UnitPatch,
  UnitView,
  YardFields,
  YardUnitCounts,
  YardView,
} from '../domain';

const yardColumns = {
  id: yards.id,
  supplierProfileId: yards.supplierProfileId,
  name: yards.name,
  address: yards.address,
  createdAt: yards.createdAt,
  updatedAt: yards.updatedAt,
  cityGeoId: cities.geoId,
  cityName: cities.name,
};

const unitColumns = {
  id: equipmentUnits.id,
  supplierProfileId: equipmentUnits.supplierProfileId,
  modelYear: equipmentUnits.modelYear,
  condition: equipmentUnits.condition,
  label: equipmentUnits.label,
  status: equipmentUnits.status,
  createdAt: equipmentUnits.createdAt,
  updatedAt: equipmentUnits.updatedAt,
  listingId: equipmentListings.id,
  listingTitle: equipmentListings.title,
  modelId: equipmentModels.id,
  modelName: equipmentModels.modelName,
  manufacturerId: manufacturers.id,
  manufacturerName: manufacturers.name,
  yardId: yards.id,
  yardName: yards.name,
  cityGeoId: cities.geoId,
  cityName: cities.name,
};

function toYardView(row: {
  id: string;
  supplierProfileId: string;
  name: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
  cityGeoId: string;
  cityName: string;
}): YardView {
  const { cityGeoId, cityName, ...rest } = row;
  return { ...rest, city: { geoId: cityGeoId, name: cityName } };
}

@Injectable()
export class DrizzleFleetRepository implements FleetRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findSupplierProfileId(accountId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: supplierProfiles.id })
      .from(supplierProfiles)
      .where(eq(supplierProfiles.accountId, accountId))
      .limit(1);
    return row?.id ?? null;
  }

  async findEnabledCityId(geoId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: cities.id })
      .from(cities)
      .where(and(eq(cities.geoId, geoId), eq(cities.enabled, true)))
      .limit(1);
    return row?.id ?? null;
  }

  async listingBelongsTo(listingId: string, supplierProfileId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: equipmentListings.id })
      .from(equipmentListings)
      .where(
        and(
          eq(equipmentListings.id, listingId),
          eq(equipmentListings.supplierProfileId, supplierProfileId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async createYard(supplierProfileId: string, fields: YardFields, now: Date): Promise<string> {
    const [row] = await this.db
      .insert(yards)
      .values({ ...fields, supplierProfileId, createdAt: now, updatedAt: now })
      .returning({ id: yards.id });
    return row!.id;
  }

  async updateYard(
    id: string,
    supplierProfileId: string,
    patch: Partial<YardFields>,
    updatedAt: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .update(yards)
      .set({ ...patch, updatedAt })
      .where(and(eq(yards.id, id), eq(yards.supplierProfileId, supplierProfileId)))
      .returning({ id: yards.id });
    return rows.length > 0;
  }

  async deleteYard(id: string, supplierProfileId: string): Promise<boolean> {
    const rows = await this.db
      .delete(yards)
      .where(and(eq(yards.id, id), eq(yards.supplierProfileId, supplierProfileId)))
      .returning({ id: yards.id });
    return rows.length > 0;
  }

  async findYard(id: string, supplierProfileId: string): Promise<YardView | null> {
    const [row] = await this.selectYards()
      .where(and(eq(yards.id, id), eq(yards.supplierProfileId, supplierProfileId)))
      .limit(1);
    return row ? toYardView(row) : null;
  }

  async listYards(supplierProfileId: string): Promise<YardView[]> {
    const rows = await this.selectYards()
      .where(eq(yards.supplierProfileId, supplierProfileId))
      .orderBy(asc(sql`lower(${yards.name})`), asc(yards.id));
    return rows.map(toYardView);
  }

  async countUnitsInYard(yardId: string): Promise<YardUnitCounts> {
    const rows = await this.db
      .select({ status: equipmentUnits.status, total: count() })
      .from(equipmentUnits)
      .where(eq(equipmentUnits.yardId, yardId))
      .groupBy(equipmentUnits.status);
    const of = (status: string) => rows.find((r) => r.status === status)?.total ?? 0;
    return { active: of('ACTIVE'), retired: of('RETIRED') };
  }

  createUnit(
    supplierProfileId: string,
    fields: UnitFields,
    identifiers: AssetIdentifier[],
    now: Date,
  ): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(equipmentUnits)
        .values({ ...fields, supplierProfileId, createdAt: now, updatedAt: now })
        .returning({ id: equipmentUnits.id });
      const unitId = row!.id;
      if (identifiers.length > 0) {
        await tx
          .insert(assetIdentifiers)
          .values(identifiers.map((i) => ({ ...i, unitId, supplierProfileId })));
      }
      return unitId;
    });
  }

  updateUnit(
    id: string,
    supplierProfileId: string,
    patch: UnitPatch,
    updatedAt: Date,
  ): Promise<boolean> {
    const { identifiers, ...fields } = patch;
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(equipmentUnits)
        .set({ ...fields, updatedAt })
        .where(
          and(
            eq(equipmentUnits.id, id),
            eq(equipmentUnits.supplierProfileId, supplierProfileId),
            eq(equipmentUnits.status, 'ACTIVE'),
          ),
        )
        .returning({ id: equipmentUnits.id });
      if (rows.length === 0) return false;
      if (identifiers !== undefined) {
        await tx.delete(assetIdentifiers).where(eq(assetIdentifiers.unitId, id));
        if (identifiers.length > 0) {
          await tx
            .insert(assetIdentifiers)
            .values(identifiers.map((i) => ({ ...i, unitId: id, supplierProfileId })));
        }
      }
      return true;
    });
  }

  async retireUnit(id: string, supplierProfileId: string, updatedAt: Date): Promise<boolean> {
    const rows = await this.db
      .update(equipmentUnits)
      .set({ status: 'RETIRED', updatedAt })
      .where(
        and(
          eq(equipmentUnits.id, id),
          eq(equipmentUnits.supplierProfileId, supplierProfileId),
          eq(equipmentUnits.status, 'ACTIVE'),
        ),
      )
      .returning({ id: equipmentUnits.id });
    return rows.length > 0;
  }

  async findUnit(id: string, supplierProfileId: string): Promise<UnitView | null> {
    const [view] = await this.unitViews(
      and(eq(equipmentUnits.id, id), eq(equipmentUnits.supplierProfileId, supplierProfileId)),
    );
    return view ?? null;
  }

  listUnits(supplierProfileId: string, filters: UnitFilters): Promise<UnitView[]> {
    return this.unitViews(
      and(
        eq(equipmentUnits.supplierProfileId, supplierProfileId),
        filters.listingId === undefined
          ? undefined
          : eq(equipmentUnits.listingId, filters.listingId),
        filters.yardId === undefined ? undefined : eq(equipmentUnits.yardId, filters.yardId),
        filters.status === undefined ? undefined : eq(equipmentUnits.status, filters.status),
      ),
    );
  }

  async countActiveUnitsForListing(listingId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(equipmentUnits)
      .where(and(eq(equipmentUnits.listingId, listingId), eq(equipmentUnits.status, 'ACTIVE')));
    return row?.total ?? 0;
  }

  private selectYards() {
    return this.db.select(yardColumns).from(yards).innerJoin(cities, eq(cities.id, yards.cityId));
  }

  /** The model always comes from the listing; a unit never stores its own. */
  private async unitViews(where: SQL | undefined): Promise<UnitView[]> {
    const rows = await this.db
      .select(unitColumns)
      .from(equipmentUnits)
      .innerJoin(equipmentListings, eq(equipmentListings.id, equipmentUnits.listingId))
      .innerJoin(equipmentModels, eq(equipmentModels.id, equipmentListings.modelId))
      .innerJoin(manufacturers, eq(manufacturers.id, equipmentModels.manufacturerId))
      .innerJoin(yards, eq(yards.id, equipmentUnits.yardId))
      .innerJoin(cities, eq(cities.id, yards.cityId))
      .where(where)
      .orderBy(desc(equipmentUnits.createdAt), desc(equipmentUnits.id));
    const identifiers = await this.identifiersFor(rows.map((r) => r.id));
    return rows.map((row) => ({
      id: row.id,
      supplierProfileId: row.supplierProfileId,
      listing: { id: row.listingId, title: row.listingTitle },
      model: {
        id: row.modelId,
        modelName: row.modelName,
        manufacturer: { id: row.manufacturerId, name: row.manufacturerName },
      },
      yard: {
        id: row.yardId,
        name: row.yardName,
        city: { geoId: row.cityGeoId, name: row.cityName },
      },
      modelYear: row.modelYear,
      condition: row.condition,
      label: row.label,
      status: row.status,
      identifiers: identifiers.get(row.id) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private async identifiersFor(unitIds: string[]): Promise<Map<string, AssetIdentifier[]>> {
    const byUnit = new Map<string, AssetIdentifier[]>();
    if (unitIds.length === 0) return byUnit;
    const rows = await this.db
      .select({
        unitId: assetIdentifiers.unitId,
        type: assetIdentifiers.type,
        value: assetIdentifiers.value,
      })
      .from(assetIdentifiers)
      .where(inArray(assetIdentifiers.unitId, unitIds))
      .orderBy(asc(assetIdentifiers.type));
    for (const { unitId, ...identifier } of rows) {
      const list = byUnit.get(unitId) ?? [];
      list.push(identifier);
      byUnit.set(unitId, list);
    }
    return byUnit;
  }
}
