import type { ListingSummaryDto } from '@ee/contracts';
import { asc, inArray } from 'drizzle-orm';
import { cities, equipmentListings, listingMedia } from '../../../platform/database/schema';
import { readNumeric } from '../../../platform/money';
import type { Executor } from '../../availability/infrastructure/busy-units';
import { photoUrl } from '../../equipment-listings/http/dto';

/** Columns to select alongside a join on equipment_listings + cities. */
export const listingSummaryColumns = {
  listingId: equipmentListings.id,
  listingTitle: equipmentListings.title,
  listingPricePerDay: equipmentListings.pricePerDay,
  cityName: cities.name,
};

export interface ListingSummaryRow {
  listingId: string;
  listingTitle: string;
  listingPricePerDay: string;
  cityName: string;
}

/** Cover photo URL (first photo by position) for each listing that has one. */
export async function coverPhotoUrls(
  db: Executor,
  listingIds: readonly string[],
): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (listingIds.length === 0) return covers;
  const rows = await db
    .select({ id: listingMedia.id, listingId: listingMedia.listingId })
    .from(listingMedia)
    .where(inArray(listingMedia.listingId, [...new Set(listingIds)]))
    .orderBy(asc(listingMedia.position), asc(listingMedia.id));
  for (const row of rows) {
    if (!covers.has(row.listingId)) covers.set(row.listingId, photoUrl(row.listingId, row.id));
  }
  return covers;
}

export function toListingSummary(
  row: ListingSummaryRow,
  covers: Map<string, string>,
): ListingSummaryDto {
  return {
    id: row.listingId,
    title: row.listingTitle,
    coverPhotoUrl: covers.get(row.listingId) ?? null,
    city: row.cityName,
    pricePerDay: readNumeric(row.listingPricePerDay)!,
  };
}
