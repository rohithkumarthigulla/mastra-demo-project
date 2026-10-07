import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, gt, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import { equipmentListings, listingMedia } from '../../../platform/database/schema';
import {
  MediaLimitReachedError,
  isPermutation,
  type ListingMedia,
  type ListingMediaRepository,
  type NewListingMedia,
} from '../domain';

type Row = typeof listingMedia.$inferSelect;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Serialises photo writes per listing so counts and positions stay consistent. */
async function lockListing(tx: Tx, listingId: string): Promise<void> {
  await tx
    .select({ id: equipmentListings.id })
    .from(equipmentListings)
    .where(eq(equipmentListings.id, listingId))
    .for('update');
}

const toMedia = (row: Row): ListingMedia => ({
  ...row,
  mimeType: row.mimeType as ListingMedia['mimeType'],
});

@Injectable()
export class DrizzleListingMediaRepository implements ListingMediaRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listForListing(listingId: string): Promise<ListingMedia[]> {
    const rows = await this.db
      .select()
      .from(listingMedia)
      .where(eq(listingMedia.listingId, listingId))
      .orderBy(asc(listingMedia.position), asc(listingMedia.createdAt));
    return rows.map(toMedia);
  }

  async find(listingId: string, mediaId: string): Promise<ListingMedia | null> {
    const [row] = await this.db
      .select()
      .from(listingMedia)
      .where(and(eq(listingMedia.listingId, listingId), eq(listingMedia.id, mediaId)))
      .limit(1);
    return row ? toMedia(row) : null;
  }

  insert(media: NewListingMedia, max: number, now: Date): Promise<ListingMedia> {
    return this.db.transaction(async (tx) => {
      await lockListing(tx, media.listingId);
      const [{ total }] = (await tx
        .select({ total: count() })
        .from(listingMedia)
        .where(eq(listingMedia.listingId, media.listingId))) as [{ total: number }];
      if (total >= max) throw new MediaLimitReachedError(max);
      const [row] = await tx
        .insert(listingMedia)
        .values({ ...media, position: total, createdAt: now, updatedAt: now })
        .returning();
      return toMedia(row!);
    });
  }

  delete(listingId: string, mediaId: string, now: Date): Promise<ListingMedia | null> {
    return this.db.transaction(async (tx) => {
      await lockListing(tx, listingId);
      const [row] = await tx
        .delete(listingMedia)
        .where(and(eq(listingMedia.listingId, listingId), eq(listingMedia.id, mediaId)))
        .returning();
      if (!row) return null;
      await tx
        .update(listingMedia)
        .set({ position: sql`${listingMedia.position} - 1`, updatedAt: now })
        .where(and(eq(listingMedia.listingId, listingId), gt(listingMedia.position, row.position)));
      return toMedia(row);
    });
  }

  reorder(listingId: string, orderedIds: string[], now: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await lockListing(tx, listingId);
      const current = await tx
        .select({ id: listingMedia.id })
        .from(listingMedia)
        .where(eq(listingMedia.listingId, listingId));
      if (
        !isPermutation(
          orderedIds,
          current.map((row) => row.id),
        )
      )
        return false;
      for (const [position, id] of orderedIds.entries()) {
        await tx
          .update(listingMedia)
          .set({ position, updatedAt: now })
          .where(and(eq(listingMedia.listingId, listingId), eq(listingMedia.id, id)));
      }
      return true;
    });
  }
}
