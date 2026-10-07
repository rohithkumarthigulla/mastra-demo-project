import { randomUUID } from 'node:crypto';
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

export interface SeedCity {
  id: string;
  geoId: string;
  name: string;
  enabled: boolean;
}

export interface SeedModel {
  id: string;
  modelName: string;
  status: 'ACTIVE' | 'INACTIVE';
  manufacturer: { id: string; name: string };
  category: { code: string; displayName: string };
}

export interface SeedProfile {
  id: string;
  accountId: string;
  displayName: string;
}

interface StoredListing extends ListingFields {
  id: string;
  supplierProfileId: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class InMemoryEquipmentListingsRepository implements EquipmentListingRepository {
  readonly cities: SeedCity[] = [];
  readonly models: SeedModel[] = [];
  readonly profiles: SeedProfile[] = [];
  private readonly listings: StoredListing[] = [];

  /** Photos per listing; Part 2 tests plug the media repository in here. */
  photosFor: (listingId: string) => ListingPhoto[] = () => [];

  /** ACTIVE machines per listing; fleet tests plug the fleet repository in here. */
  activeUnitsFor: (listingId: string) => number = () => 0;

  findSupplierProfileId(accountId: string): Promise<string | null> {
    return Promise.resolve(this.profiles.find((p) => p.accountId === accountId)?.id ?? null);
  }

  findEnabledCityId(geoId: string): Promise<string | null> {
    return Promise.resolve(this.cities.find((c) => c.geoId === geoId && c.enabled)?.id ?? null);
  }

  isActiveModel(modelId: string): Promise<boolean> {
    return Promise.resolve(this.models.some((m) => m.id === modelId && m.status === 'ACTIVE'));
  }

  create(supplierProfileId: string, fields: ListingFields, now: Date): Promise<string> {
    const id = randomUUID();
    this.listings.push({
      ...fields,
      id,
      supplierProfileId,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    });
    return Promise.resolve(id);
  }

  update(
    id: string,
    supplierProfileId: string,
    patch: Partial<ListingFields>,
    updatedAt: Date,
  ): Promise<boolean> {
    const row = this.owned(id, supplierProfileId);
    if (!row) return Promise.resolve(false);
    Object.assign(row, patch, { updatedAt });
    return Promise.resolve(true);
  }

  setStatus(
    id: string,
    supplierProfileId: string,
    from: ListingStatus,
    to: ListingStatus,
    updatedAt: Date,
  ): Promise<boolean> {
    const row = this.owned(id, supplierProfileId);
    if (!row || row.status !== from) return Promise.resolve(false);
    row.status = to;
    row.updatedAt = updatedAt;
    return Promise.resolve(true);
  }

  findView(id: string, scope: ListingScope): Promise<ListingView | null> {
    const row = this.listings.find((l) => l.id === id && inScope(l, scope));
    return Promise.resolve(row ? this.toView(row) : null);
  }

  listForSupplier(
    supplierProfileId: string,
    query: Page & { status?: ListingStatus },
  ): Promise<ListingPageResult> {
    return Promise.resolve(
      this.page(
        this.listings.filter(
          (l) =>
            l.supplierProfileId === supplierProfileId &&
            (query.status === undefined || l.status === query.status),
        ),
        query,
      ),
    );
  }

  browse(filters: BrowseFilters): Promise<ListingPageResult> {
    const q = filters.q?.toLowerCase();
    const matches = this.listings.filter((l) => {
      if (l.status !== 'ACTIVE') return false;
      const view = this.toView(l);
      return (
        (filters.cityGeoId === undefined || view.city.geoId === filters.cityGeoId) &&
        (filters.categoryCode === undefined || view.model.category.code === filters.categoryCode) &&
        (filters.modelId === undefined || l.modelId === filters.modelId) &&
        (filters.manufacturerId === undefined ||
          view.model.manufacturer.id === filters.manufacturerId) &&
        (filters.minPrice === undefined || l.pricePerDay >= filters.minPrice) &&
        (filters.maxPrice === undefined || l.pricePerDay <= filters.maxPrice) &&
        (q === undefined || l.title.toLowerCase().includes(q))
      );
    });
    return Promise.resolve(this.page(matches, filters));
  }

  countActiveUnits(listingId: string): Promise<number> {
    return Promise.resolve(this.activeUnitsFor(listingId));
  }

  private owned(id: string, supplierProfileId: string): StoredListing | undefined {
    return this.listings.find((l) => l.id === id && l.supplierProfileId === supplierProfileId);
  }

  private page(rows: StoredListing[], page: Page): ListingPageResult {
    const sorted = [...rows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
    );
    return {
      items: sorted.slice(page.offset, page.offset + page.limit).map((l) => this.toView(l)),
      total: rows.length,
    };
  }

  private toView(row: StoredListing): ListingView {
    const model = this.models.find((m) => m.id === row.modelId)!;
    const city = this.cities.find((c) => c.id === row.cityId)!;
    const profile = this.profiles.find((p) => p.id === row.supplierProfileId)!;
    return {
      id: row.id,
      supplierProfileId: row.supplierProfileId,
      status: row.status,
      title: row.title,
      description: row.description,
      location: row.location,
      pricePerDay: row.pricePerDay,
      model: {
        id: model.id,
        modelName: model.modelName,
        manufacturer: { ...model.manufacturer },
        category: { ...model.category },
      },
      city: { geoId: city.geoId, name: city.name },
      supplier: { id: profile.id, displayName: profile.displayName },
      photos: this.photosFor(row.id),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

function inScope(listing: StoredListing, scope: ListingScope): boolean {
  return 'publicOnly' in scope
    ? listing.status === 'ACTIVE'
    : listing.supplierProfileId === scope.supplierProfileId;
}
