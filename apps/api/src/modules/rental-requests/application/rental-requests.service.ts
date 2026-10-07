import { Inject, Injectable } from '@nestjs/common';
import {
  rentalDays,
  type CreateRentalRequest,
  type ListIncomingRentalRequestsQuery,
  type ListMyRentalRequestsQuery,
  type RejectRentalRequest,
  type RentalRequestDto,
  type RentalRequestPageDto,
} from '@ee/contracts';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../../platform/auth';
import { DB, type Database } from '../../../platform/database';
import {
  equipmentListings,
  quotes,
  rateCards,
  rentalRequests,
  supplierProfiles,
} from '../../../platform/database/schema';
import { readNumeric } from '../../../platform/money';
import { freeUnitIds, type Executor } from '../../availability/infrastructure/busy-units';
import { rentalRange } from '../../bookings/domain/booking';
import { autoDraftLines } from '../../quotes/domain/auto-draft';
import { OPEN_QUOTE_STATUSES } from '../../quotes/domain/quote';
import { insertQuote } from '../../quotes/infrastructure/quote-writes';
import {
  DuplicateRentalRequestError,
  NoUnitAvailableError,
  RentalListingNotFoundError,
  RentalRequestNotFoundError,
  RentalRequestNotPendingError,
} from '../domain/errors';
import { notify } from '../infrastructure/notify';
import {
  findRequestDto,
  listRequestDtos,
  type RequestViewer,
} from '../infrastructure/rental-request.reader';

const builder = (accountId: string): RequestViewer => ({ role: 'BUILDER', accountId });
const supplier = (accountId: string): RequestViewer => ({ role: 'SUPPLIER', accountId });

export const requestHref = (id: string) => `/rental-requests/${id}`;

@Injectable()
export class RentalRequestsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(accountId: string, body: CreateRentalRequest): Promise<RentalRequestDto> {
    const now = this.clock.now();
    const id = await this.db.transaction(async (tx) => {
      // Locking the listing serialises concurrent requests for it, so the duplicate
      // check below cannot race.
      const [listing] = await tx
        .select({
          id: equipmentListings.id,
          title: equipmentListings.title,
          pricePerDay: equipmentListings.pricePerDay,
          supplierProfileId: equipmentListings.supplierProfileId,
          supplierAccountId: supplierProfiles.accountId,
        })
        .from(equipmentListings)
        .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
        .where(
          and(eq(equipmentListings.id, body.listingId), eq(equipmentListings.status, 'ACTIVE')),
        )
        .for('update', { of: equipmentListings });
      if (!listing) throw new RentalListingNotFoundError();

      const [duplicate] = await tx
        .select({ id: rentalRequests.id })
        .from(rentalRequests)
        .where(
          and(
            eq(rentalRequests.listingId, listing.id),
            eq(rentalRequests.builderAccountId, accountId),
            eq(rentalRequests.status, 'PENDING'),
            lte(rentalRequests.startDate, body.endDate),
            gte(rentalRequests.endDate, body.startDate),
          ),
        )
        .limit(1);
      if (duplicate) throw new DuplicateRentalRequestError();

      const free = await freeUnitIds(tx, listing.id, rentalRange(body.startDate, body.endDate));
      if (free.length === 0) throw new NoUnitAvailableError();

      const [request] = await tx
        .insert(rentalRequests)
        .values({
          listingId: listing.id,
          builderAccountId: accountId,
          startDate: body.startDate,
          endDate: body.endDate,
          message: body.message ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: rentalRequests.id });
      const requestId = request!.id;

      await this.autoDraft(tx, {
        requestId,
        listingId: listing.id,
        supplierProfileId: listing.supplierProfileId,
        unitId: free[0]!,
        days: rentalDays(body.startDate, body.endDate),
        pricePerDay: readNumeric(listing.pricePerDay)!,
        now,
      });
      await notify(
        tx,
        [
          {
            accountId: listing.supplierAccountId,
            kind: 'REQUEST_RECEIVED',
            title: `New rental request for ${listing.title}`,
            detail: `${body.startDate} to ${body.endDate}`,
            href: requestHref(requestId),
          },
        ],
        now,
      );
      return requestId;
    });
    return this.get(builder(accountId), id);
  }

  async listMine(
    accountId: string,
    query: ListMyRentalRequestsQuery,
  ): Promise<RentalRequestPageDto> {
    const page = await listRequestDtos(
      this.db,
      builder(accountId),
      { status: query.status },
      query,
    );
    return { ...page, limit: query.limit, offset: query.offset };
  }

  async listIncoming(
    accountId: string,
    query: ListIncomingRentalRequestsQuery,
  ): Promise<RentalRequestPageDto> {
    const page = await listRequestDtos(
      this.db,
      supplier(accountId),
      { status: query.status, listingId: query.listingId },
      query,
    );
    return { ...page, limit: query.limit, offset: query.offset };
  }

  async getFor(
    role: 'BUILDER' | 'SUPPLIER',
    accountId: string,
    id: string,
  ): Promise<RentalRequestDto> {
    return this.get({ role, accountId }, id);
  }

  async cancel(accountId: string, id: string): Promise<RentalRequestDto> {
    const viewer = builder(accountId);
    const current = await this.get(viewer, id);
    const now = this.clock.now();
    await this.db.transaction(async (tx) => {
      await this.closePending(tx, id, { status: 'CANCELLED', updatedAt: now });
      const supplierAccountId = await this.supplierAccountOf(tx, id);
      await notify(
        tx,
        [
          {
            accountId: supplierAccountId,
            kind: 'REQUEST_WITHDRAWN',
            title: `${current.builderName} cancelled their request for ${current.listing.title}`,
            href: requestHref(id),
          },
        ],
        now,
      );
    });
    return this.get(viewer, id);
  }

  async reject(
    accountId: string,
    id: string,
    body: RejectRentalRequest,
  ): Promise<RentalRequestDto> {
    const viewer = supplier(accountId);
    const current = await this.get(viewer, id);
    const now = this.clock.now();
    await this.db.transaction(async (tx) => {
      const builderAccountId = await this.closePending(tx, id, {
        status: 'REJECTED',
        declineReason: body.reason ?? null,
        updatedAt: now,
      });
      await notify(
        tx,
        [
          {
            accountId: builderAccountId,
            kind: 'REQUEST_DECLINED',
            title: `${current.supplierName} declined your request for ${current.listing.title}`,
            detail: body.reason ?? null,
            href: requestHref(id),
          },
        ],
        now,
      );
    });
    return this.get(viewer, id);
  }

  /** Only the first call records the view and notifies the builder. */
  async markViewed(accountId: string, id: string): Promise<RentalRequestDto> {
    const viewer = supplier(accountId);
    const current = await this.get(viewer, id);
    if (current.viewedAt === null) {
      const now = this.clock.now();
      await this.db.transaction(async (tx) => {
        const [first] = await tx
          .update(rentalRequests)
          .set({ viewedAt: now })
          .where(and(eq(rentalRequests.id, id), isNull(rentalRequests.viewedAt)))
          .returning({ builderAccountId: rentalRequests.builderAccountId });
        if (!first) return;
        await notify(
          tx,
          [
            {
              accountId: first.builderAccountId,
              kind: 'JOB_VIEWED',
              title: `${current.supplierName} viewed your request for ${current.listing.title}`,
              href: requestHref(id),
            },
          ],
          now,
        );
      });
    }
    return this.get(viewer, id);
  }

  private async get(viewer: RequestViewer, id: string): Promise<RentalRequestDto> {
    const dto = await findRequestDto(this.db, viewer, id);
    if (!dto) throw new RentalRequestNotFoundError();
    return dto;
  }

  /**
   * Compare-and-set out of PENDING, expiring any open quote with it.
   * Returns the builder's account id.
   */
  private async closePending(
    tx: Executor,
    id: string,
    set: Partial<typeof rentalRequests.$inferInsert> & { updatedAt: Date },
  ): Promise<string> {
    const [row] = await tx
      .update(rentalRequests)
      .set(set)
      .where(and(eq(rentalRequests.id, id), eq(rentalRequests.status, 'PENDING')))
      .returning({ builderAccountId: rentalRequests.builderAccountId });
    if (!row) throw new RentalRequestNotPendingError();
    await tx
      .update(quotes)
      .set({ status: 'EXPIRED', decidedAt: set.updatedAt, updatedAt: set.updatedAt })
      .where(and(eq(quotes.rentalRequestId, id), inArray(quotes.status, [...OPEN_QUOTE_STATUSES])));
    return row.builderAccountId;
  }

  private async supplierAccountOf(tx: Executor, requestId: string): Promise<string> {
    const [row] = await tx
      .select({ accountId: supplierProfiles.accountId })
      .from(rentalRequests)
      .innerJoin(equipmentListings, eq(equipmentListings.id, rentalRequests.listingId))
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
      .where(eq(rentalRequests.id, requestId));
    return row!.accountId;
  }

  /** Listings with a rate card get a quote drafted for supplier approval, hidden from the builder. */
  private async autoDraft(
    tx: Executor,
    input: {
      requestId: string;
      listingId: string;
      supplierProfileId: string;
      unitId: string;
      days: number;
      pricePerDay: number;
      now: Date;
    },
  ): Promise<void> {
    const [card] = await tx
      .select()
      .from(rateCards)
      .where(eq(rateCards.listingId, input.listingId));
    if (!card) return;
    await insertQuote(
      tx,
      {
        rentalRequestId: input.requestId,
        supplierProfileId: input.supplierProfileId,
        equipmentUnitId: input.unitId,
        status: 'PENDING_APPROVAL',
        autoDrafted: true,
        notes: null,
        validUntil: null,
        lines: autoDraftLines(input.days, input.pricePerDay, {
          weekRate: readNumeric(card.weekRate),
          monthRate: readNumeric(card.monthRate),
          transportFee: readNumeric(card.transportFee),
          depositAmount: readNumeric(card.depositAmount),
        }),
      },
      input.now,
    );
  }
}
