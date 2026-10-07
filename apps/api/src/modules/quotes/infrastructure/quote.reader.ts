import { rentalDays, todayInRentalZone, type QuoteDto, type QuoteStatus } from '@ee/contracts';
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, or, type SQL } from 'drizzle-orm';
import {
  accounts,
  bookings,
  cities,
  equipmentListings,
  quoteLines,
  quotes,
  rentalRequests,
  supplierProfiles,
} from '../../../platform/database/schema';
import { readNumeric } from '../../../platform/money';
import type { Executor } from '../../availability/infrastructure/busy-units';
import {
  coverPhotoUrls,
  listingSummaryColumns,
  toListingSummary,
} from '../../rental-requests/infrastructure/listing-summary';
import { BUILDER_VISIBLE_QUOTE_STATUSES, effectiveQuoteStatus } from '../domain/quote';

export interface QuoteViewer {
  role: 'BUILDER' | 'SUPPLIER';
  accountId: string;
}

const columns = {
  id: quotes.id,
  status: quotes.status,
  equipmentUnitId: quotes.equipmentUnitId,
  subtotal: quotes.subtotal,
  taxPercent: quotes.taxPercent,
  taxAmount: quotes.taxAmount,
  depositAmount: quotes.depositAmount,
  total: quotes.total,
  notes: quotes.notes,
  validUntil: quotes.validUntil,
  autoDrafted: quotes.autoDrafted,
  sentAt: quotes.sentAt,
  decidedAt: quotes.decidedAt,
  createdAt: quotes.createdAt,
  updatedAt: quotes.updatedAt,
  requestId: rentalRequests.id,
  requestStatus: rentalRequests.status,
  startDate: rentalRequests.startDate,
  endDate: rentalRequests.endDate,
  requirementId: rentalRequests.requirementId,
  builderName: accounts.displayName,
  supplierName: supplierProfiles.displayName,
  ...listingSummaryColumns,
};

function base(db: Executor) {
  return db
    .select(columns)
    .from(quotes)
    .innerJoin(rentalRequests, eq(rentalRequests.id, quotes.rentalRequestId))
    .innerJoin(equipmentListings, eq(equipmentListings.id, rentalRequests.listingId))
    .innerJoin(cities, eq(cities.id, equipmentListings.cityId))
    .innerJoin(supplierProfiles, eq(supplierProfiles.id, quotes.supplierProfileId))
    .innerJoin(accounts, eq(accounts.id, rentalRequests.builderAccountId));
}

type Row = Awaited<ReturnType<typeof base>>[number];

/** Builders only ever see their own sent-or-later quotes; suppliers their own quotes. */
function visibleTo(viewer: QuoteViewer): SQL {
  return viewer.role === 'BUILDER'
    ? and(
        eq(rentalRequests.builderAccountId, viewer.accountId),
        inArray(quotes.status, [...BUILDER_VISIBLE_QUOTE_STATUSES]),
      )!
    : eq(supplierProfiles.accountId, viewer.accountId);
}

/**
 * Filters on the status as read: SENT past `validUntil` counts as EXPIRED, not SENT.
 */
function statusIs(status: QuoteStatus, today: string): SQL {
  const lapsed = and(eq(quotes.status, 'SENT'), lt(quotes.validUntil, today))!;
  if (status === 'EXPIRED') return or(eq(quotes.status, 'EXPIRED'), lapsed)!;
  if (status === 'SENT') {
    return and(
      eq(quotes.status, 'SENT'),
      or(isNull(quotes.validUntil), gte(quotes.validUntil, today)),
    )!;
  }
  return eq(quotes.status, status);
}

async function toDtos(db: Executor, rows: Row[]): Promise<QuoteDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [lineRows, bookingRows, covers] = await Promise.all([
    db
      .select()
      .from(quoteLines)
      .where(inArray(quoteLines.quoteId, ids))
      .orderBy(asc(quoteLines.position)),
    db
      .select({ id: bookings.id, quoteId: bookings.quoteId })
      .from(bookings)
      .where(inArray(bookings.quoteId, ids)),
    coverPhotoUrls(
      db,
      rows.map((r) => r.listingId),
    ),
  ]);
  const today = todayInRentalZone();
  const bookingByQuote = new Map(bookingRows.map((b) => [b.quoteId, b.id]));
  return rows.map((r) => ({
    id: r.id,
    status: effectiveQuoteStatus(r.status, r.validUntil, today),
    equipmentUnitId: r.equipmentUnitId,
    lines: lineRows
      .filter((l) => l.quoteId === r.id)
      .map((l) => {
        const amount = readNumeric(l.amount)!;
        return {
          id: l.id,
          type: l.type,
          description: l.description,
          quantity: l.quantity,
          unitAmount: readNumeric(l.unitAmount)!,
          amount: l.type === 'DISCOUNT' ? -amount : amount,
          position: l.position,
        };
      }),
    subtotal: readNumeric(r.subtotal)!,
    taxPercent: readNumeric(r.taxPercent)!,
    taxAmount: readNumeric(r.taxAmount)!,
    depositAmount: readNumeric(r.depositAmount)!,
    total: readNumeric(r.total)!,
    notes: r.notes,
    validUntil: r.validUntil,
    autoDrafted: r.autoDrafted,
    sentAt: r.sentAt?.toISOString() ?? null,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    rentalRequest: {
      id: r.requestId,
      status: r.requestStatus,
      startDate: r.startDate,
      endDate: r.endDate,
      days: rentalDays(r.startDate, r.endDate),
      requirementId: r.requirementId,
    },
    listing: toListingSummary(r, covers),
    builderName: r.builderName,
    supplierName: r.supplierName,
    bookingId: bookingByQuote.get(r.id) ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function findQuoteDto(
  db: Executor,
  viewer: QuoteViewer,
  id: string,
): Promise<QuoteDto | null> {
  const rows = await base(db).where(and(eq(quotes.id, id), visibleTo(viewer)));
  return (await toDtos(db, rows))[0] ?? null;
}

export async function listQuoteDtos(
  db: Executor,
  viewer: QuoteViewer,
  filter: { status?: QuoteStatus },
  page: { limit: number; offset: number },
): Promise<{ items: QuoteDto[]; total: number }> {
  const where = and(
    visibleTo(viewer),
    filter.status ? statusIs(filter.status, todayInRentalZone()) : undefined,
  );
  const [rows, [totals]] = await Promise.all([
    base(db)
      .where(where)
      .orderBy(desc(quotes.createdAt), desc(quotes.id))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: count() })
      .from(quotes)
      .innerJoin(rentalRequests, eq(rentalRequests.id, quotes.rentalRequestId))
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, quotes.supplierProfileId))
      .where(where),
  ]);
  return { items: await toDtos(db, rows), total: totals?.total ?? 0 };
}
