import { rentalDays, type BookingDto, type BookingStatus } from '@ee/contracts';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import {
  accounts,
  bookings,
  cities,
  equipmentListings,
  supplierProfiles,
} from '../../../platform/database/schema';
import { readNumeric } from '../../../platform/money';
import type { Executor } from '../../availability/infrastructure/busy-units';
import {
  coverPhotoUrls,
  listingSummaryColumns,
  toListingSummary,
} from '../../rental-requests/infrastructure/listing-summary';
import { rentalDate } from '../domain/booking';

export type BookingViewer =
  { role: 'BUILDER'; accountId: string } | { role: 'SUPPLIER'; accountId: string };

const columns = {
  id: bookings.id,
  status: bookings.status,
  quoteId: bookings.quoteId,
  rentalRequestId: bookings.rentalRequestId,
  equipmentUnitId: bookings.equipmentUnitId,
  startAt: bookings.startAt,
  endAt: bookings.endAt,
  total: bookings.total,
  dispatchedAt: bookings.dispatchedAt,
  rentStartedAt: bookings.rentStartedAt,
  returnedAt: bookings.returnedAt,
  cancelledAt: bookings.cancelledAt,
  cancelReason: bookings.cancelReason,
  createdAt: bookings.createdAt,
  updatedAt: bookings.updatedAt,
  builderName: accounts.displayName,
  supplierName: supplierProfiles.displayName,
  ...listingSummaryColumns,
};

function base(db: Executor) {
  return db
    .select(columns)
    .from(bookings)
    .innerJoin(equipmentListings, eq(equipmentListings.id, bookings.listingId))
    .innerJoin(cities, eq(cities.id, equipmentListings.cityId))
    .innerJoin(supplierProfiles, eq(supplierProfiles.id, bookings.supplierProfileId))
    .innerJoin(accounts, eq(accounts.id, bookings.builderAccountId));
}

function visibleTo(viewer: BookingViewer): SQL {
  return viewer.role === 'BUILDER'
    ? eq(bookings.builderAccountId, viewer.accountId)
    : eq(supplierProfiles.accountId, viewer.accountId);
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

async function toDtos(
  db: Executor,
  rows: Awaited<ReturnType<ReturnType<typeof base>['where']>>,
): Promise<BookingDto[]> {
  if (rows.length === 0) return [];
  const covers = await coverPhotoUrls(
    db,
    rows.map((r) => r.listingId),
  );
  return rows.map((r) => {
    const startDate = rentalDate(r.startAt);
    // endAt is exclusive: the last rented day is the one just before it.
    const endDate = rentalDate(new Date(r.endAt.getTime() - 1));
    return {
      id: r.id,
      status: r.status,
      quoteId: r.quoteId,
      rentalRequestId: r.rentalRequestId,
      equipmentUnitId: r.equipmentUnitId,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      startDate,
      endDate,
      days: rentalDays(startDate, endDate),
      total: readNumeric(r.total)!,
      listing: toListingSummary(r, covers),
      builderName: r.builderName,
      supplierName: r.supplierName,
      dispatchedAt: iso(r.dispatchedAt),
      rentStartedAt: iso(r.rentStartedAt),
      returnedAt: iso(r.returnedAt),
      cancelledAt: iso(r.cancelledAt),
      cancelReason: r.cancelReason,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

export async function findBookingDto(
  db: Executor,
  viewer: BookingViewer,
  id: string,
): Promise<BookingDto | null> {
  const rows = await base(db).where(and(eq(bookings.id, id), visibleTo(viewer)));
  return (await toDtos(db, rows))[0] ?? null;
}

export async function listBookingDtos(
  db: Executor,
  viewer: BookingViewer,
  filter: { status?: BookingStatus },
  page: { limit: number; offset: number },
): Promise<{ items: BookingDto[]; total: number }> {
  const where = and(
    visibleTo(viewer),
    filter.status ? eq(bookings.status, filter.status) : undefined,
  );
  const [rows, [totals]] = await Promise.all([
    base(db)
      .where(where)
      .orderBy(desc(bookings.startAt), desc(bookings.id))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: count() })
      .from(bookings)
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, bookings.supplierProfileId))
      .where(where),
  ]);
  return { items: await toDtos(db, rows), total: totals?.total ?? 0 };
}
