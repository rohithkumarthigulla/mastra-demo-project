import type { ListingStatus } from '@ee/contracts';
import type { ModelSearch } from '../../api';
import type { ListingFilters } from './filters';

/** One place for cache keys so mutations can refresh every list that shows a listing. */
export const queryKeys = {
  supplierListings: (status?: ListingStatus, page?: number) =>
    ['supplier-listings', status ?? 'ALL', page ?? 1] as const,
  supplierListing: (id: string) => ['supplier-listings', 'detail', id] as const,
  supplierProfile: ['supplier-profile'] as const,
  browse: (filters: ListingFilters, page: number) => ['listings', filters, page] as const,
  listing: (id: string) => ['listings', 'detail', id] as const,
  models: (search: ModelSearch) => ['knowledge', 'models', search] as const,
  model: (id: string) => ['knowledge', 'model', id] as const,
  manufacturers: ['knowledge', 'manufacturers'] as const,
  categories: ['knowledge', 'categories'] as const,
  specificationDefinitions: ['knowledge', 'specification-definitions'] as const,
  reference: ['reference'] as const,
};

/** Every cached listing list or detail, supplier and public. */
export const LISTING_KEY_ROOTS = [['supplier-listings'], ['listings']] as const;
