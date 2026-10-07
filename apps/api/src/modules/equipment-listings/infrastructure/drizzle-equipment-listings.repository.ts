import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, type SQL } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import {
  cities,
  equipmentCategories,
  equipmentListings,
  equipmentModels,
  listingMedia,
  manufacturers,
  supplierProfiles,
} from '../../../platform/database/schema';
import { readNumeric, toNumericString } from '../../../platform/money';
import type {
  BrowseFilters,
  EquipmentListingRepository,
  ListingFields,
  ListingPageResult,
  ListingPhoto,
  ListingScope,
  ListingStatus,
  ListingView,
  Page,
} from '../domain';

function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function toColumns(fields: Partial<ListingFields>) {
  const { pricePerDay, ...rest } = fields;
  return pricePerDay === undefined ? rest : { ...rest, pricePerDay: toNumericString(pricePerDay) };
}

const viewColumns = {
  id: equipmentListings.id,
  supplierProfileId: equipmentListings.supplierProfileId,
  status: equipmentListings.status,
  title: equipmentListings.title,
  description: equipmentListings.description,
  location: equipmentListings.location,
  pricePerDay: equipmentListings.pricePerDay,
  createdAt: equipmentListings.createdAt,
  updatedAt: equipmentListings.updatedAt,
  modelId: equipmentModels.id,
  modelName: equipmentModels.modelName,
  manufacturerId: manufacturers.id,
  manufacturerName: manufacturers.name,
  categoryCode: equipmentCategories.code,
  categoryDisplayName: equipmentCategories.displayName,
  cityGeoId: cities.geoId,
  cityName: cities.name,
  supplierDisplayName: supplierProfiles.displayName,
};

type ViewRow = {
  [K in keyof typeof viewColumns]: (typeof viewColumns)[K]['_']['data'];
};

@Injectable()
export class DrizzleEquipmentListingsRepository implements EquipmentListingRepository {
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

  async isActiveModel(modelId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: equipmentModels.id })
      .from(equipmentModels)
      .where(and(eq(equipmentModels.id, modelId), eq(equipmentModels.status, 'ACTIVE')))
      .limit(1);
    return row !== undefined;
  }

  async create(supplierProfileId: string, fields: ListingFields, now: Date): Promise<string> {
    const [row] = await this.db
      .insert(equipmentListings)
      .values({
        ...fields,
        pricePerDay: toNumericString(fields.pricePerDay),
        supplierProfileId,
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: equipmentListings.id });
    return row!.id;
  }

  async update(
    id: string,
    supplierProfileId: string,
    patch: Partial<ListingFields>,
    updatedAt: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .update(equipmentListings)
      .set({ ...toColumns(patch), updatedAt })
      .where(
        and(
          eq(equipmentListings.id, id),
          eq(equipmentListings.supplierProfileId, supplierProfileId),
        ),
      )
      .returning({ id: equipmentListings.id });
    return rows.length > 0;
  }

  async setStatus(
    id: string,
    supplierProfileId: string,
    from: ListingStatus,
    to: ListingStatus,
    updatedAt: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .update(equipmentListings)
      .set({ status: to, updatedAt })
      .where(
        and(
          eq(equipmentListings.id, id),
          eq(equipmentListings.supplierProfileId, supplierProfileId),
          eq(equipmentListings.status, from),
        ),
      )
      .returning({ id: equipmentListings.id });
    return rows.length > 0;
  }

  async findView(id: string, scope: ListingScope): Promise<ListingView | null> {
    const ownership =
      'publicOnly' in scope
        ? eq(equipmentListings.status, 'ACTIVE')
        : eq(equipmentListings.supplierProfileId, scope.supplierProfileId);
    const rows = await this.selectView()
      .where(and(eq(equipmentListings.id, id), ownership))
      .limit(1);
    const [view] = await this.toViews(rows);
    return view ?? null;
  }

  listForSupplier(
    supplierProfileId: string,
    query: Page & { status?: ListingStatus },
  ): Promise<ListingPageResult> {
    return this.page(
      and(
        eq(equipmentListings.supplierProfileId, supplierProfileId),
        query.status === undefined ? undefined : eq(equipmentListings.status, query.status),
      ),
      query,
    );
  }

  browse(filters: BrowseFilters): Promise<ListingPageResult> {
    const optional = <T>(value: T | undefined, build: (v: T) => SQL) =>
      value === undefined ? undefined : build(value);
    return this.page(
      and(
        eq(equipmentListings.status, 'ACTIVE'),
        optional(filters.cityGeoId, (v) => eq(cities.geoId, v)),
        optional(filters.categoryCode, (v) => eq(equipmentCategories.code, v)),
        optional(filters.modelId, (v) => eq(equipmentModels.id, v)),
        optional(filters.manufacturerId, (v) => eq(manufacturers.id, v)),
        optional(filters.minPrice, (v) => gte(equipmentListings.pricePerDay, toNumericString(v))),
        optional(filters.maxPrice, (v) => lte(equipmentListings.pricePerDay, toNumericString(v))),
        optional(filters.q, (v) => ilike(equipmentListings.title, containsPattern(v))),
      ),
      filters,
    );
  }

  private async page(where: SQL | undefined, page: Page): Promise<ListingPageResult> {
    const [rows, [totals]] = await Promise.all([
      this.selectView()
        .where(where)
        .orderBy(desc(equipmentListings.createdAt), desc(equipmentListings.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ total: count() })
        .from(equipmentListings)
        .innerJoin(equipmentModels, eq(equipmentModels.id, equipmentListings.modelId))
        .innerJoin(manufacturers, eq(manufacturers.id, equipmentModels.manufacturerId))
        .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipmentModels.categoryId))
        .innerJoin(cities, eq(cities.id, equipmentListings.cityId))
        .where(where),
    ]);
    return { items: await this.toViews(rows), total: totals?.total ?? 0 };
  }

  /** Category always comes from the model, so a listing cannot disagree with the knowledge base. */
  private selectView() {
    return this.db
      .select(viewColumns)
      .from(equipmentListings)
      .innerJoin(equipmentModels, eq(equipmentModels.id, equipmentListings.modelId))
      .innerJoin(manufacturers, eq(manufacturers.id, equipmentModels.manufacturerId))
      .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipmentModels.categoryId))
      .innerJoin(cities, eq(cities.id, equipmentListings.cityId))
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId));
  }

  /** One query for the photos of every listing on the page, grouped and ordered. */
  private async photosFor(listingIds: string[]): Promise<Map<string, ListingPhoto[]>> {
    const byListing = new Map<string, ListingPhoto[]>();
    if (listingIds.length === 0) return byListing;
    const rows = await this.db
      .select({
        id: listingMedia.id,
        listingId: listingMedia.listingId,
        mimeType: listingMedia.mimeType,
        position: listingMedia.position,
      })
      .from(listingMedia)
      .where(inArray(listingMedia.listingId, listingIds))
      .orderBy(asc(listingMedia.position), asc(listingMedia.createdAt));
    for (const { listingId, ...photo } of rows) {
      byListing.set(listingId, [...(byListing.get(listingId) ?? []), photo]);
    }
    return byListing;
  }

  private async toViews(rows: ViewRow[]): Promise<ListingView[]> {
    const photos = await this.photosFor(rows.map((row) => row.id));
    return rows.map((row): ListingView => ({
      id: row.id,
      supplierProfileId: row.supplierProfileId,
      status: row.status,
      title: row.title,
      description: row.description,
      location: row.location,
      pricePerDay: readNumeric(row.pricePerDay)!,
      model: {
        id: row.modelId,
        modelName: row.modelName,
        manufacturer: { id: row.manufacturerId, name: row.manufacturerName },
        category: { code: row.categoryCode, displayName: row.categoryDisplayName },
      },
      city: { geoId: row.cityGeoId, name: row.cityName },
      supplier: { id: row.supplierProfileId, displayName: row.supplierDisplayName },
      photos: photos.get(row.id) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
