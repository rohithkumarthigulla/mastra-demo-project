import {
  rentalDays,
  todayInRentalZone,
  type RentalRequestDto,
  type RentalRequestStatus,
} from '@ee/contracts';
import { and, count, desc, eq, inArray, type SQL } from 'drizzle-orm';
import {
  accounts,
  cities,
  equipmentListings,
  quotes,
  rentalRequests,
  supplierProfiles,
} from '../../../platform/database/schema';
import { readNumeric } from '../../../platform/money';
import type { Executor } from '../../availability/infrastructure/busy-units';
import { BUILDER_VISIBLE_QUOTE_STATUSES, effectiveQuoteStatus } from '../../quotes/domain/quote';
import { coverPhotoUrls, listingSummaryColumns, toListingSummary } from './listing-summary';

/** Who is reading: builders see only their own requests and only sent quotes. */
export type RequestViewer =
  { role: 'BUILDER'; accountId: string } | { role: 'SUPPLIER'; accountId: string };

export interface RequestFilter {
  status?: RentalRequestStatus;
  listingId?: string;
}

const columns = {
  id: rentalRequests.id,
  status: rentalRequests.status,
  requirementId: rentalRequests.requirementId,
  startDate: rentalRequests.startDate,
  endDate: rentalRequests.endDate,
  message: rentalRequests.message,
  declineReason: rentalRequests.declineReason,
  viewedAt: rentalRequests.viewedAt,
  createdAt: rentalRequests.createdAt,
  updatedAt: rentalRequests.updatedAt,
  builderName: accounts.displayName,
  supplierName: supplierProfiles.displayName,
  ...listingSummaryColumns,
};

function base(db: Executor) {
  return db
    .select(columns)
    .from(rentalRequests)
    .innerJoin(equipmentListings, eq(equipmentListings.id, rentalRequests.listingId))
    .innerJoin(cities, eq(cities.id, equipmentListings.cityId))
    .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
    .innerJoin(accounts, eq(accounts.id, rentalRequests.builderAccountId));
}

function visibleTo(viewer: RequestViewer): SQL {
  return viewer.role === 'BUILDER'
    ? eq(rentalRequests.builderAccountId, viewer.accountId)
    : eq(supplierProfiles.accountId, viewer.accountId);
}

async function toDtos(
  db: Executor,
  viewer: RequestViewer,
  rows: Awaited<ReturnType<ReturnType<typeof base>['where']>>,
): Promise<RentalRequestDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const quoteRows = await db
    .select({
      id: quotes.id,
      rentalRequestId: quotes.rentalRequestId,
      status: quotes.status,
      total: quotes.total,
      validUntil: quotes.validUntil,
    })
    .from(quotes)
    .where(
      and(
        inArray(quotes.rentalRequestId, ids),
        viewer.role === 'BUILDER'
          ? inArray(quotes.status, [...BUILDER_VISIBLE_QUOTE_STATUSES])
          : undefined,
      ),
    )
    .orderBy(desc(quotes.createdAt), desc(quotes.id));
  const today = todayInRentalZone();
  const latest = new Map<string, RentalRequestDto['latestQuote']>();
  for (const q of quoteRows) {
    if (latest.has(q.rentalRequestId)) continue;
    latest.set(q.rentalRequestId, {
      id: q.id,
      status: effectiveQuoteStatus(q.status, q.validUntil, today),
      total: readNumeric(q.total)!,
    });
  }
  const covers = await coverPhotoUrls(
    db,
    rows.map((r) => r.listingId),
  );
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    requirementId: r.requirementId,
    startDate: r.startDate,
    endDate: r.endDate,
    days: rentalDays(r.startDate, r.endDate),
    message: r.message,
    declineReason: r.declineReason,
    viewedAt: r.viewedAt?.toISOString() ?? null,
    listing: toListingSummary(r, covers),
    builderName: r.builderName,
    supplierName: r.supplierName,
    latestQuote: latest.get(r.id) ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** The request as `viewer` may see it, or `null` when it is not theirs. */
export async function findRequestDto(
  db: Executor,
  viewer: RequestViewer,
  id: string,
): Promise<RentalRequestDto | null> {
  const rows = await base(db).where(and(eq(rentalRequests.id, id), visibleTo(viewer)));
  return (await toDtos(db, viewer, rows))[0] ?? null;
}

export async function listRequestDtos(
  db: Executor,
  viewer: RequestViewer,
  filter: RequestFilter,
  page: { limit: number; offset: number },
): Promise<{ items: RentalRequestDto[]; total: number }> {
  const where = and(
    visibleTo(viewer),
    filter.status ? eq(rentalRequests.status, filter.status) : undefined,
    filter.listingId ? eq(rentalRequests.listingId, filter.listingId) : undefined,
  );
  const [rows, [totals]] = await Promise.all([
    base(db)
      .where(where)
      .orderBy(desc(rentalRequests.createdAt), desc(rentalRequests.id))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: count() })
      .from(rentalRequests)
      .innerJoin(equipmentListings, eq(equipmentListings.id, rentalRequests.listingId))
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
      .where(where),
  ]);
  return { items: await toDtos(db, viewer, rows), total: totals?.total ?? 0 };
}
