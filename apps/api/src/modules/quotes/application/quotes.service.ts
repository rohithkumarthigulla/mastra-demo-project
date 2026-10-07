import { Inject, Injectable } from '@nestjs/common';
import {
  todayInRentalZone,
  type CalendarDate,
  type CreateQuoteRequest,
  type ListQuotesQuery,
  type QuoteDto,
  type QuotePageDto,
  type RejectQuoteRequest,
  type UpdateQuoteRequest,
} from '@ee/contracts';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../../platform/auth';
import {
  DB,
  isExclusionViolation,
  isUniqueViolation,
  type Database,
} from '../../../platform/database';
import {
  bookings,
  equipmentListings,
  equipmentUnits,
  quoteLines,
  quotes,
  rentalRequests,
  requirements,
  supplierProfiles,
} from '../../../platform/database/schema';
import { busyUnitIds, type Executor } from '../../availability/infrastructure/busy-units';
import { rentalRange } from '../../bookings/domain/booking';
import { notify, type NotificationInput } from '../../rental-requests/infrastructure/notify';
import { requestHref } from '../../rental-requests/application/rental-requests.service';
import {
  IncompleteQuoteError,
  InvalidQuoteUnitError,
  QuoteAlreadyOpenError,
  QuoteExpiredValidityError,
  QuoteNotEditableError,
  QuoteNotFoundError,
  QuoteNotOpenError,
  QuoteRequestClosedError,
  UnitUnavailableError,
} from '../domain/errors';
import {
  EDITABLE_QUOTE_STATUSES,
  effectiveQuoteStatus,
  OPEN_QUOTE_STATUSES,
} from '../domain/quote';
import { insertQuote, replaceQuoteLines } from '../infrastructure/quote-writes';
import { findQuoteDto, listQuoteDtos, type QuoteViewer } from '../infrastructure/quote.reader';

const quoteHref = (id: string) => `/quotes/${id}`;
const bookingHref = (id: string) => `/bookings/${id}`;

interface RequestContext {
  id: string;
  status: string;
  listingId: string;
  listingTitle: string;
  builderAccountId: string;
  requirementId: string | null;
  startDate: CalendarDate;
  endDate: CalendarDate;
  supplierProfileId: string;
  supplierAccountId: string;
  supplierName: string;
}

@Injectable()
export class QuotesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  getFor(viewer: QuoteViewer, id: string): Promise<QuoteDto> {
    return this.get(viewer, id);
  }

  async list(viewer: QuoteViewer, query: ListQuotesQuery): Promise<QuotePageDto> {
    const page = await listQuoteDtos(this.db, viewer, { status: query.status }, query);
    return { ...page, limit: query.limit, offset: query.offset };
  }

  async create(accountId: string, body: CreateQuoteRequest): Promise<QuoteDto> {
    const viewer: QuoteViewer = { role: 'SUPPLIER', accountId };
    assertValidUntil(body.validUntil ?? null);
    const now = this.clock.now();
    const id = await this.db
      .transaction(async (tx) => {
        const request = await requestFor(tx, eq(rentalRequests.id, body.rentalRequestId));
        if (!request || request.supplierAccountId !== accountId) throw new QuoteNotFoundError();
        if (request.status !== 'PENDING') throw new QuoteRequestClosedError();
        if (body.equipmentUnitId) await assertUnitOnListing(tx, body.equipmentUnitId, request);
        return insertQuote(
          tx,
          {
            rentalRequestId: request.id,
            supplierProfileId: request.supplierProfileId,
            equipmentUnitId: body.equipmentUnitId ?? null,
            status: 'DRAFT',
            autoDrafted: false,
            notes: body.notes ?? null,
            validUntil: body.validUntil ?? null,
            lines: body.lines,
          },
          now,
        );
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new QuoteAlreadyOpenError();
        throw error;
      });
    return this.get(viewer, id);
  }

  async update(accountId: string, id: string, body: UpdateQuoteRequest): Promise<QuoteDto> {
    const viewer: QuoteViewer = { role: 'SUPPLIER', accountId };
    if (body.validUntil) assertValidUntil(body.validUntil);
    const now = this.clock.now();
    await this.db.transaction(async (tx) => {
      const { quote, request } = await this.lockOwnQuote(tx, accountId, id);
      if (!isEditable(quote.status)) throw new QuoteNotEditableError();
      if (body.equipmentUnitId) await assertUnitOnListing(tx, body.equipmentUnitId, request);
      if (body.lines) await replaceQuoteLines(tx, id, body.lines, now);
      await tx
        .update(quotes)
        .set({
          ...(body.equipmentUnitId !== undefined && { equipmentUnitId: body.equipmentUnitId }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.validUntil !== undefined && { validUntil: body.validUntil }),
          updatedAt: now,
        })
        .where(eq(quotes.id, id));
    });
    return this.get(viewer, id);
  }

  async send(accountId: string, id: string): Promise<QuoteDto> {
    const viewer: QuoteViewer = { role: 'SUPPLIER', accountId };
    const now = this.clock.now();
    await this.db.transaction(async (tx) => {
      const { quote, request } = await this.lockOwnQuote(tx, accountId, id);
      if (!isEditable(quote.status)) throw new QuoteNotEditableError();
      if (request.status !== 'PENDING') throw new QuoteRequestClosedError();
      assertValidUntil(quote.validUntil);
      const lines = await tx
        .select({ type: quoteLines.type })
        .from(quoteLines)
        .where(eq(quoteLines.quoteId, id));
      if (lines.filter((l) => l.type === 'RENTAL').length !== 1) {
        throw new IncompleteQuoteError('A quote needs exactly one RENTAL line before it is sent');
      }
      if (!quote.equipmentUnitId) {
        throw new IncompleteQuoteError('Pick a machine (equipmentUnitId) before sending');
      }
      await assertUnitOnListing(tx, quote.equipmentUnitId, request);
      const range = rentalRange(request.startDate, request.endDate);
      if ((await busyUnitIds(tx, [quote.equipmentUnitId], range)).size > 0) {
        throw new UnitUnavailableError();
      }
      await tx
        .update(quotes)
        .set({ status: 'SENT', sentAt: now, updatedAt: now })
        .where(eq(quotes.id, id));
      await notify(
        tx,
        [
          {
            accountId: request.builderAccountId,
            kind: 'QUOTE_RECEIVED',
            title: `${request.supplierName} sent a quote for ${request.listingTitle}`,
            href: quoteHref(id),
          },
        ],
        now,
      );
    });
    return this.get(viewer, id);
  }

  async reject(accountId: string, id: string, body: RejectQuoteRequest): Promise<QuoteDto> {
    void body.reason; // The contract accepts a reason, but quotes have no column to keep it.
    const viewer: QuoteViewer = { role: 'BUILDER', accountId };
    const now = this.clock.now();
    await this.db.transaction(async (tx) => {
      const { quote } = await this.lockBuilderQuote(tx, accountId, id);
      if (effectiveQuoteStatus(quote.status, quote.validUntil, todayInRentalZone()) !== 'SENT') {
        throw new QuoteNotOpenError();
      }
      await tx
        .update(quotes)
        .set({ status: 'REJECTED', decidedAt: now, updatedAt: now })
        .where(eq(quotes.id, id));
    });
    return this.get(viewer, id);
  }

  /**
   * Accepts a sent quote: books the machine and settles the request (and its requirement)
   * in one transaction. The bookings EXCLUDE constraint is the final word on overlap, so a
   * concurrent acceptance for the same machine rolls this one back with a 409.
   */
  async accept(accountId: string, id: string): Promise<QuoteDto> {
    const viewer: QuoteViewer = { role: 'BUILDER', accountId };
    const now = this.clock.now();
    await this.db
      .transaction(async (tx) => {
        const { quote, request } = await this.lockBuilderQuote(tx, accountId, id);
        if (effectiveQuoteStatus(quote.status, quote.validUntil, todayInRentalZone()) !== 'SENT') {
          throw new QuoteNotOpenError();
        }
        const unitId = quote.equipmentUnitId!;
        const range = rentalRange(request.startDate, request.endDate);
        // Blocks are not covered by the bookings EXCLUDE constraint, so check them here.
        if ((await busyUnitIds(tx, [unitId], range)).size > 0) throw new UnitUnavailableError();

        const [settled] = await tx
          .update(rentalRequests)
          .set({ status: 'ACCEPTED', updatedAt: now })
          .where(and(eq(rentalRequests.id, request.id), eq(rentalRequests.status, 'PENDING')))
          .returning({ id: rentalRequests.id });
        if (!settled) throw new QuoteRequestClosedError();
        await tx
          .update(quotes)
          .set({ status: 'ACCEPTED', decidedAt: now, updatedAt: now })
          .where(eq(quotes.id, id));
        const [booking] = await tx
          .insert(bookings)
          .values({
            quoteId: id,
            rentalRequestId: request.id,
            listingId: request.listingId,
            equipmentUnitId: unitId,
            supplierProfileId: request.supplierProfileId,
            builderAccountId: request.builderAccountId,
            startAt: range.start,
            endAt: range.end,
            status: 'CONFIRMED',
            total: quote.total,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: bookings.id });

        const notes: NotificationInput[] = [
          {
            accountId: request.supplierAccountId,
            kind: 'QUOTE_ACCEPTED',
            title: `Your quote for ${request.listingTitle} was accepted`,
            href: bookingHref(booking!.id),
          },
          {
            accountId: request.builderAccountId,
            kind: 'BOOKING_CONFIRMED',
            title: `Booking confirmed: ${request.listingTitle}`,
            detail: `${request.startDate} to ${request.endDate}`,
            href: bookingHref(booking!.id),
          },
        ];
        if (request.requirementId) {
          notes.push(...(await awardRequirement(tx, request, id, now)));
        }
        await notify(tx, notes, now);
      })
      .catch((error: unknown) => {
        if (isExclusionViolation(error)) throw new UnitUnavailableError();
        throw error;
      });
    return this.get(viewer, id);
  }

  private async get(viewer: QuoteViewer, id: string): Promise<QuoteDto> {
    const dto = await findQuoteDto(this.db, viewer, id);
    if (!dto) throw new QuoteNotFoundError();
    return dto;
  }

  private async lockOwnQuote(tx: Executor, accountId: string, id: string) {
    const locked = await lockQuote(tx, id);
    if (!locked || locked.request.supplierAccountId !== accountId) throw new QuoteNotFoundError();
    return locked;
  }

  /** Builders cannot see unsent quotes, so those are 404 rather than 409. */
  private async lockBuilderQuote(tx: Executor, accountId: string, id: string) {
    const locked = await lockQuote(tx, id);
    if (
      !locked ||
      locked.request.builderAccountId !== accountId ||
      isEditable(locked.quote.status)
    ) {
      throw new QuoteNotFoundError();
    }
    return locked;
  }
}

function isEditable(status: string): boolean {
  return (EDITABLE_QUOTE_STATUSES as readonly string[]).includes(status);
}

function assertValidUntil(validUntil: CalendarDate | null): void {
  if (validUntil !== null && validUntil < todayInRentalZone())
    throw new QuoteExpiredValidityError();
}

async function requestFor(
  tx: Executor,
  where: ReturnType<typeof eq>,
): Promise<RequestContext | undefined> {
  const [row] = await tx
    .select({
      id: rentalRequests.id,
      status: rentalRequests.status,
      listingId: rentalRequests.listingId,
      listingTitle: equipmentListings.title,
      builderAccountId: rentalRequests.builderAccountId,
      requirementId: rentalRequests.requirementId,
      startDate: rentalRequests.startDate,
      endDate: rentalRequests.endDate,
      supplierProfileId: supplierProfiles.id,
      supplierAccountId: supplierProfiles.accountId,
      supplierName: supplierProfiles.displayName,
    })
    .from(rentalRequests)
    .innerJoin(equipmentListings, eq(equipmentListings.id, rentalRequests.listingId))
    .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
    .where(where);
  return row;
}

/** Locks the quote row so concurrent edits, sends and decisions on it serialise. */
async function lockQuote(tx: Executor, id: string) {
  const [quote] = await tx
    .select({
      id: quotes.id,
      status: quotes.status,
      equipmentUnitId: quotes.equipmentUnitId,
      validUntil: quotes.validUntil,
      total: quotes.total,
      rentalRequestId: quotes.rentalRequestId,
    })
    .from(quotes)
    .where(eq(quotes.id, id))
    .for('update');
  if (!quote) return null;
  const request = await requestFor(tx, eq(rentalRequests.id, quote.rentalRequestId));
  return { quote, request: request! };
}

async function assertUnitOnListing(tx: Executor, unitId: string, request: RequestContext) {
  const [unit] = await tx
    .select({ id: equipmentUnits.id })
    .from(equipmentUnits)
    .where(
      and(
        eq(equipmentUnits.id, unitId),
        eq(equipmentUnits.listingId, request.listingId),
        eq(equipmentUnits.status, 'ACTIVE'),
      ),
    );
  if (!unit) throw new InvalidQuoteUnitError();
}

/**
 * Awards the requirement to the accepted quote and withdraws its competing invitations,
 * expiring their open quotes. Returns the notifications for the losing suppliers.
 */
async function awardRequirement(
  tx: Executor,
  request: RequestContext,
  quoteId: string,
  now: Date,
): Promise<NotificationInput[]> {
  const requirementId = request.requirementId!;
  const [requirement] = await tx
    .update(requirements)
    .set({ status: 'AWARDED', awardedQuoteId: quoteId, updatedAt: now })
    .where(eq(requirements.id, requirementId))
    .returning({ title: requirements.title });

  const withdrawn = await tx
    .update(rentalRequests)
    .set({ status: 'WITHDRAWN', updatedAt: now })
    .where(
      and(
        eq(rentalRequests.requirementId, requirementId),
        eq(rentalRequests.status, 'PENDING'),
        ne(rentalRequests.id, request.id),
      ),
    )
    .returning({ id: rentalRequests.id, listingId: rentalRequests.listingId });
  if (withdrawn.length === 0) return [];

  const withdrawnIds = withdrawn.map((r) => r.id);
  const expired = await tx
    .update(quotes)
    .set({ status: 'EXPIRED', decidedAt: now, updatedAt: now })
    .where(
      and(
        inArray(quotes.rentalRequestId, withdrawnIds),
        inArray(quotes.status, [...OPEN_QUOTE_STATUSES]),
      ),
    )
    .returning({ rentalRequestId: quotes.rentalRequestId });
  const quoted = new Set(expired.map((q) => q.rentalRequestId));

  const owners = await tx
    .select({ listingId: equipmentListings.id, accountId: supplierProfiles.accountId })
    .from(equipmentListings)
    .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
    .where(
      inArray(
        equipmentListings.id,
        withdrawn.map((r) => r.listingId),
      ),
    );
  const ownerOf = new Map(owners.map((o) => [o.listingId, o.accountId]));
  const title = requirement?.title ?? 'the requirement';
  return withdrawn.map((r): NotificationInput =>
    quoted.has(r.id)
      ? {
          accountId: ownerOf.get(r.listingId)!,
          kind: 'QUOTE_LOST',
          title: `Another supplier won "${title}"`,
          href: requestHref(r.id),
        }
      : {
          accountId: ownerOf.get(r.listingId)!,
          kind: 'REQUEST_WITHDRAWN',
          title: `Request for "${title}" was withdrawn`,
          detail: 'The builder awarded the requirement to another supplier.',
          href: requestHref(r.id),
        },
  );
}
