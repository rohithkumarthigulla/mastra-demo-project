import { randomUUID } from 'node:crypto';
import {
  MediaLimitReachedError,
  isPermutation,
  type ListingMedia,
  type ListingMediaRepository,
  type ListingPhoto,
  type NewListingMedia,
} from '../domain';

export class InMemoryListingMediaRepository implements ListingMediaRepository {
  private rows: ListingMedia[] = [];

  /** Plugs into `InMemoryEquipmentListingsRepository.photosFor`. */
  photosFor = (listingId: string): ListingPhoto[] =>
    this.ordered(listingId).map(({ id, mimeType, position }) => ({ id, mimeType, position }));

  listForListing(listingId: string): Promise<ListingMedia[]> {
    return Promise.resolve(this.ordered(listingId).map((row) => ({ ...row })));
  }

  find(listingId: string, mediaId: string): Promise<ListingMedia | null> {
    const row = this.rows.find((r) => r.listingId === listingId && r.id === mediaId);
    return Promise.resolve(row ? { ...row } : null);
  }

  insert(media: NewListingMedia, max: number, now: Date): Promise<ListingMedia> {
    const position = this.ordered(media.listingId).length;
    if (position >= max) return Promise.reject(new MediaLimitReachedError(max));
    const row: ListingMedia = {
      ...media,
      id: randomUUID(),
      position,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }

  delete(listingId: string, mediaId: string, now: Date): Promise<ListingMedia | null> {
    const row = this.rows.find((r) => r.listingId === listingId && r.id === mediaId);
    if (!row) return Promise.resolve(null);
    this.rows = this.rows.filter((r) => r !== row);
    for (const other of this.ordered(listingId)) {
      if (other.position > row.position) {
        other.position -= 1;
        other.updatedAt = now;
      }
    }
    return Promise.resolve({ ...row });
  }

  reorder(listingId: string, orderedIds: string[], now: Date): Promise<boolean> {
    const current = this.ordered(listingId);
    if (
      !isPermutation(
        orderedIds,
        current.map((r) => r.id),
      )
    )
      return Promise.resolve(false);
    for (const row of current) {
      row.position = orderedIds.indexOf(row.id);
      row.updatedAt = now;
    }
    return Promise.resolve(true);
  }

  private ordered(listingId: string): ListingMedia[] {
    return this.rows
      .filter((r) => r.listingId === listingId)
      .sort((a, b) => a.position - b.position);
  }
}
