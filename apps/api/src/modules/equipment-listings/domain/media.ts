import type { ListingMediaMimeType } from '@ee/contracts';

export const LISTING_MEDIA_REPOSITORY = Symbol('LISTING_MEDIA_REPOSITORY');

export interface ListingMedia {
  id: string;
  listingId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: ListingMediaMimeType;
  sizeBytes: number;
  /** 0-based; the photo at position 0 is the cover. */
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export type NewListingMedia = Pick<
  ListingMedia,
  'listingId' | 'storageKey' | 'originalFilename' | 'mimeType' | 'sizeBytes'
>;

export interface ListingMediaRepository {
  /** Ordered by position. */
  listForListing(listingId: string): Promise<ListingMedia[]>;
  find(listingId: string, mediaId: string): Promise<ListingMedia | null>;
  /** Appends at the end; throws `MediaLimitReachedError` if the listing already has `max` photos. */
  insert(media: NewListingMedia, max: number, now: Date): Promise<ListingMedia>;
  /** Deletes the photo and closes the gap in positions; returns the deleted row, if any. */
  delete(listingId: string, mediaId: string, now: Date): Promise<ListingMedia | null>;
  /** Returns false unless `orderedIds` is exactly the listing's current photo ids. */
  reorder(listingId: string, orderedIds: string[], now: Date): Promise<boolean>;
}

/** True if `ids` contains every id of `current` exactly once and nothing else. */
export function isPermutation(ids: string[], current: string[]): boolean {
  const wanted = new Set(ids);
  return (
    ids.length === current.length &&
    wanted.size === ids.length &&
    current.every((id) => wanted.has(id))
  );
}
