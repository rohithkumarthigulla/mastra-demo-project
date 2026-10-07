import type { ListingStatus, ListingView } from './listing';

export const EQUIPMENT_LISTING_REPOSITORY = Symbol('EQUIPMENT_LISTING_REPOSITORY');

export interface ListingFields {
  modelId: string;
  cityId: string;
  title: string;
  description: string;
  location: string;
  pricePerDay: number;
}

export interface Page {
  limit: number;
  offset: number;
}

export interface BrowseFilters extends Page {
  cityGeoId?: string;
  categoryCode?: string;
  modelId?: string;
  manufacturerId?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Case-insensitive substring of the title. */
  q?: string;
}

/** Either the owner's view (any status) or the public view (ACTIVE only). */
export type ListingScope = { supplierProfileId: string } | { publicOnly: true };

export interface ListingPageResult {
  items: ListingView[];
  total: number;
}

export interface EquipmentListingRepository {
  findSupplierProfileId(accountId: string): Promise<string | null>;
  findEnabledCityId(geoId: string): Promise<string | null>;
  isActiveModel(modelId: string): Promise<boolean>;
  create(supplierProfileId: string, fields: ListingFields, now: Date): Promise<string>;
  /** Returns false if no listing with this id belongs to the supplier. */
  update(
    id: string,
    supplierProfileId: string,
    patch: Partial<ListingFields>,
    updatedAt: Date,
  ): Promise<boolean>;
  /** Compare-and-set: only changes the status if it is still `from`. */
  setStatus(
    id: string,
    supplierProfileId: string,
    from: ListingStatus,
    to: ListingStatus,
    updatedAt: Date,
  ): Promise<boolean>;
  findView(id: string, scope: ListingScope): Promise<ListingView | null>;
  listForSupplier(
    supplierProfileId: string,
    query: Page & { status?: ListingStatus },
  ): Promise<ListingPageResult>;
  browse(filters: BrowseFilters): Promise<ListingPageResult>;
  countActiveUnits(listingId: string): Promise<number>;
}
