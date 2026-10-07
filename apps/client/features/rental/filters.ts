import { browseListingsQuerySchema, type BrowseListingsQuery } from '@ee/contracts';

/** The browse filters a builder can set; pagination is tracked separately as `page`. */
export interface ListingFilters {
  city?: string;
  category?: string;
  manufacturer?: string;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  modelId?: string;
}

export const LISTINGS_PAGE_SIZE = 20;

const FILTER_KEYS = [
  'city',
  'category',
  'manufacturer',
  'minPrice',
  'maxPrice',
  'q',
  'modelId',
] as const;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return text?.trim() ? text.trim() : undefined;
}

/**
 * Reads filters and page from URL search params. Each filter is checked on its own
 * against the API schema and dropped when invalid, so one bad value in a shared link
 * doesn't throw away the rest. A min price above the max drops both.
 */
export function filtersFromParams(params: Params): { filters: ListingFilters; page: number } {
  const shape = browseListingsQuerySchema.shape;
  const filters: ListingFilters = {};
  for (const key of FILTER_KEYS) {
    const raw = first(params[key]);
    if (raw === undefined) continue;
    const parsed = shape[key].safeParse(raw);
    if (parsed.success && parsed.data !== undefined) {
      (filters as Record<string, unknown>)[key] = parsed.data;
    }
  }
  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  ) {
    delete filters.minPrice;
    delete filters.maxPrice;
  }
  const page = Number(first(params.page));
  return { filters, page: Number.isInteger(page) && page > 1 ? page : 1 };
}

/** URL search params for the filters and page; empty values and page 1 are left out. */
export function filtersToParams(filters: ListingFilters, page = 1): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value === undefined || value === '') continue;
    params[key] = String(value);
  }
  if (page > 1) params.page = String(page);
  return params;
}

/** The API query for one page of results. */
export function browseQuery(
  filters: ListingFilters,
  page: number,
  pageSize = LISTINGS_PAGE_SIZE,
): Partial<BrowseListingsQuery> {
  return { ...filters, limit: pageSize, offset: (page - 1) * pageSize };
}

export function hasActiveFilters(filters: ListingFilters): boolean {
  return FILTER_KEYS.some((key) => key !== 'modelId' && filters[key] !== undefined);
}
