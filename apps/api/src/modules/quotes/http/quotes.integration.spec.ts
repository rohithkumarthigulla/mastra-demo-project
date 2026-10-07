import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import type { QuoteDto, QuotePageDto, RentalRequestDto } from '@ee/contracts';
import { eq, inArray } from 'drizzle-orm';
import {
  bookings,
  notifications,
  quotes,
  rentalRequests,
  requirements,
} from '../../../platform/database/schema';
import {
  dateFromToday,
  RentalFlowHarness,
  type Actor,
  type Listing,
} from '../../rental-requests/testing/rental-flow-test-app';

describe('quotes (database)', () => {
  let h: RentalFlowHarness;

  before(async () => {
    h = await RentalFlowHarness.start();
  });
  afterEach(async () => {
    await h.cleanup();
  });
  after(async () => {
    await h?.close();
  });

  const kinds = async (accountId: string) =>
    (await h.db.select().from(notifications).where(eq(notifications.accountId, accountId)))
      .map((n) => n.kind)
      .sort();

  const requestFor = async (builder: Actor, listing: Listing, start = 2, end = 4) => {
    const res = await h.request<RentalRequestDto>('POST', '/rental-requests', builder.token, {
      listingId: listing.id,
      startDate: dateFromToday(start),
      endDate: dateFromToday(end),
    });
    assert.equal(res.status, 201);
    return res.body;
  };

  const lines = [
    { type: 'RENTAL', description: 'Excavator, 3 days', quantity: 3, unitAmount: 10000.5 },
    { type: 'TRANSPORT', description: 'Delivery and pickup', quantity: 1, unitAmount: 2500 },
    { type: 'DISCOUNT', description: 'Repeat customer', quantity: 1, unitAmount: 1000 },
    { type: 'DEPOSIT', description: 'Refundable deposit', quantity: 1, unitAmount: 20000 },
  ];

  const draft = (listing: Listing, requestId: string, extra: Record<string, unknown> = {}) =>
    h.request<QuoteDto>('POST', '/quotes', listing.supplier.token, {
      rentalRequestId: requestId,
      equipmentUnitId: listing.unitIds[0],
      lines,
      ...extra,
    });

  const sentQuote = async (listing: Listing, requestId: string) => {
    const created = await draft(listing, requestId);
    assert.equal(created.status, 201);
    const sent = await h.request<QuoteDto>(
      'POST',
      `/quotes/${created.body.id}/send`,
      listing.supplier.token,
    );
    assert.equal(sent.status, 200);
    return sent.body;
  };

  it('computes totals on the server: 18% tax on the subtotal only, deposit added untaxed', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const request = await requestFor(builder, listing);

    const res = await draft(listing, request.id, {
      notes: 'Fuel extra',
      validUntil: dateFromToday(1),
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'DRAFT');
    assert.equal(res.body.autoDrafted, false);
    // 3 × 10000.50 + 2500 − 1000 = 31501.50; tax 5670.27; deposit 20000.
    assert.equal(res.body.subtotal, 31501.5);
    assert.equal(res.body.taxPercent, 18);
    assert.equal(res.body.taxAmount, 5670.27);
    assert.equal(res.body.depositAmount, 20000);
    assert.equal(res.body.total, 57171.77);
    assert.deepEqual(
      res.body.lines.map((l) => [l.type, l.amount, l.position]),
      [
        ['RENTAL', 30001.5, 0],
        ['TRANSPORT', 2500, 1],
        ['DISCOUNT', -1000, 2],
        ['DEPOSIT', 20000, 3],
      ],
    );
    assert.equal(res.body.rentalRequest.days, 3);
    assert.equal(typeof res.body.listing.city, 'string');

    // Client-sent totals are not part of the contract and are rejected outright.
    const forged = await draft(listing, request.id, { total: 1 });
    assert.equal(forged.status, 400);

    const tooMuchDiscount = await h.request(
      'PATCH',
      `/quotes/${res.body.id}`,
      listing.supplier.token,
      {
        lines: [
          { type: 'RENTAL', description: 'Day', quantity: 1, unitAmount: 100 },
          { type: 'DISCOUNT', description: 'Too much', quantity: 1, unitAmount: 200 },
        ],
      },
    );
    assert.equal(tooMuchDiscount.status, 400);
  });

  it('allows one open quote per request and only lets the owner supplier quote', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const stranger = await h.supplier('Stranger');
    const request = await requestFor(builder, listing);

    assert.equal((await draft(listing, request.id)).status, 201);
    const second = await draft(listing, request.id);
    assert.equal(second.status, 409);
    assert.equal((second.body as unknown as { code: string }).code, 'quote_already_open');

    const strangerQuote = await h.request('POST', '/quotes', stranger.token, {
      rentalRequestId: request.id,
      lines,
    });
    assert.equal(strangerQuote.status, 404);

    const otherListing = await h.listing(listing.supplier);
    const foreignUnit = await h.request('POST', '/quotes', listing.supplier.token, {
      rentalRequestId: (await requestFor(builder, otherListing)).id,
      equipmentUnitId: listing.unitIds[0],
      lines,
    });
    assert.equal(foreignUnit.status, 400);
  });

  it('edits drafts, requires a unit and one rental line to send, then locks the quote', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const request = await requestFor(builder, listing);
    const created = await h.request<QuoteDto>('POST', '/quotes', listing.supplier.token, {
      rentalRequestId: request.id,
      lines: [{ type: 'TRANSPORT', description: 'Delivery', quantity: 1, unitAmount: 2500 }],
    });
    const id = created.body.id;
    const send = () => h.request<QuoteDto>('POST', `/quotes/${id}/send`, listing.supplier.token);

    assert.equal((await send()).status, 400); // no RENTAL line
    const edited = await h.request<QuoteDto>('PATCH', `/quotes/${id}`, listing.supplier.token, {
      lines,
      notes: 'Updated',
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.notes, 'Updated');
    assert.equal(edited.body.subtotal, 31501.5);
    assert.equal((await send()).status, 400); // no unit yet

    await h.request('PATCH', `/quotes/${id}`, listing.supplier.token, {
      equipmentUnitId: listing.unitIds[0],
    });
    const sent = await send();
    assert.equal(sent.status, 200);
    assert.equal(sent.body.status, 'SENT');
    assert.ok(sent.body.sentAt);
    assert.deepEqual(await kinds(builder.accountId), ['QUOTE_RECEIVED']);

    const locked = await h.request('PATCH', `/quotes/${id}`, listing.supplier.token, {
      notes: 'Sneaky edit',
    });
    assert.equal(locked.status, 409);
    assert.equal((await send()).status, 409);

    const forBuilder = await h.request<RentalRequestDto>(
      'GET',
      `/rental-requests/${request.id}`,
      builder.token,
    );
    assert.deepEqual(forBuilder.body.latestQuote, { id, status: 'SENT', total: 57171.77 });
  });

  it('hides auto-drafted quotes from the builder until the supplier sends them', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier(), { rateCard: { transportFee: 2500 } });
    const request = await requestFor(builder, listing);
    const [auto] = await h.db
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.rentalRequestId, request.id));
    const id = auto!.id;

    for (const [method, path] of [
      ['GET', `/quotes/${id}`],
      ['POST', `/quotes/${id}/accept`],
      ['POST', `/quotes/${id}/reject`],
    ] as const) {
      const res = await h.request(method, path, builder.token, method === 'POST' ? {} : undefined);
      assert.equal(res.status, 404, `${method} ${path}`);
    }
    const builderList = await h.request<QuotePageDto>('GET', '/quotes/builder', builder.token);
    assert.equal(builderList.body.total, 0);

    const supplierView = await h.request<QuoteDto>('GET', `/quotes/${id}`, listing.supplier.token);
    assert.equal(supplierView.body.status, 'PENDING_APPROVAL');
    assert.equal(supplierView.body.autoDrafted, true);
    // The auto-draft pre-selects a machine that was free when the request came in.
    assert.equal(supplierView.body.equipmentUnitId, listing.unitIds[0]);

    assert.equal(
      (await h.request('POST', `/quotes/${id}/send`, listing.supplier.token)).status,
      200,
    );
    const visible = await h.request<QuoteDto>('GET', `/quotes/${id}`, builder.token);
    assert.equal(visible.status, 200);
    assert.equal(visible.body.status, 'SENT');
    const listed = await h.request<QuotePageDto>(
      'GET',
      '/quotes/builder?status=SENT',
      builder.token,
    );
    assert.deepEqual(
      listed.body.items.map((q) => q.id),
      [id],
    );
  });

  it('accepting a quote books the machine and drives the booking to completion', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const request = await requestFor(builder, listing);
    const quote = await sentQuote(listing, request.id);

    const accepted = await h.request<QuoteDto>('POST', `/quotes/${quote.id}/accept`, builder.token);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.status, 'ACCEPTED');
    assert.equal(accepted.body.rentalRequest.status, 'ACCEPTED');
    assert.ok(accepted.body.bookingId);
    assert.deepEqual(await kinds(listing.supplier.accountId), [
      'QUOTE_ACCEPTED',
      'REQUEST_RECEIVED',
    ]);
    assert.deepEqual(await kinds(builder.accountId), ['BOOKING_CONFIRMED', 'QUOTE_RECEIVED']);

    const [booking] = await h.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, accepted.body.bookingId!));
    assert.equal(booking!.status, 'CONFIRMED');
    assert.equal(booking!.equipmentUnitId, listing.unitIds[0]);
    assert.equal(booking!.total, '57171.77');

    assert.equal(
      (await h.request('POST', `/quotes/${quote.id}/accept`, builder.token)).status,
      409,
    );
  });

  it('lets exactly one of two racing acceptances book the same machine', async () => {
    const supplier = await h.supplier();
    const listing = await h.listing(supplier);
    const [b1, b2] = [await h.builder('Builder 1'), await h.builder('Builder 2')];
    const q1 = await sentQuote(listing, (await requestFor(b1, listing, 3, 6)).id);
    const q2 = await sentQuote(listing, (await requestFor(b2, listing, 5, 8)).id);

    const results = await Promise.all([
      h.request<QuoteDto>('POST', `/quotes/${q1.id}/accept`, b1.token),
      h.request<QuoteDto>('POST', `/quotes/${q2.id}/accept`, b2.token),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const loser = results.find((r) => r.status === 409)!;
    assert.equal((loser.body as unknown as { code: string }).code, 'unit_unavailable');

    // The losing side is untouched: its quote is still SENT, its request still PENDING.
    const loserQuoteId = results[0]!.status === 409 ? q1.id : q2.id;
    const [lq] = await h.db.select().from(quotes).where(eq(quotes.id, loserQuoteId));
    assert.equal(lq!.status, 'SENT');
    const [lr] = await h.db
      .select()
      .from(rentalRequests)
      .where(eq(rentalRequests.id, lq!.rentalRequestId));
    assert.equal(lr!.status, 'PENDING');
    const booked = await h.db
      .select()
      .from(bookings)
      .where(inArray(bookings.quoteId, [q1.id, q2.id]));
    assert.equal(booked.length, 1);
  });

  it('awards the requirement, withdraws competitors and expires their open quotes', async () => {
    const builder = await h.builder();
    const winner = await h.listing(await h.supplier('Winner'));
    const quoted = await h.listing(await h.supplier('Quoted loser'));
    const silent = await h.listing(await h.supplier('Silent loser'));
    const req = await h.requirement(
      builder,
      [winner, quoted, silent],
      dateFromToday(3),
      dateFromToday(5),
    );
    const [winnerReq, quotedReq, silentReq] = req.requestIds as [string, string, string];
    const winning = await sentQuote(winner, winnerReq);
    const losing = await sentQuote(quoted, quotedReq);

    const res = await h.request<QuoteDto>('POST', `/quotes/${winning.id}/accept`, builder.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.rentalRequest.requirementId, req.id);

    const [requirement] = await h.db.select().from(requirements).where(eq(requirements.id, req.id));
    assert.equal(requirement!.status, 'AWARDED');
    assert.equal(requirement!.awardedQuoteId, winning.id);

    const statuses = await h.db
      .select({ id: rentalRequests.id, status: rentalRequests.status })
      .from(rentalRequests)
      .where(inArray(rentalRequests.id, req.requestIds));
    const statusOf = new Map(statuses.map((s) => [s.id, s.status]));
    assert.equal(statusOf.get(winnerReq), 'ACCEPTED');
    assert.equal(statusOf.get(quotedReq), 'WITHDRAWN');
    assert.equal(statusOf.get(silentReq), 'WITHDRAWN');

    const loserView = await h.request<QuoteDto>('GET', `/quotes/${losing.id}`, builder.token);
    assert.equal(loserView.body.status, 'EXPIRED');
    assert.ok((await kinds(quoted.supplier.accountId)).includes('QUOTE_LOST'));
    assert.ok((await kinds(silent.supplier.accountId)).includes('REQUEST_WITHDRAWN'));
  });

  it('rejects a sent quote but keeps the request open for a new quote', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const request = await requestFor(builder, listing);
    const quote = await sentQuote(listing, request.id);

    const rejected = await h.request<QuoteDto>(
      'POST',
      `/quotes/${quote.id}/reject`,
      builder.token,
      {
        reason: 'Too expensive',
      },
    );
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.status, 'REJECTED');
    assert.equal(rejected.body.rentalRequest.status, 'PENDING');
    assert.equal(
      (await h.request('POST', `/quotes/${quote.id}/accept`, builder.token)).status,
      409,
    );
    assert.equal((await draft(listing, request.id)).status, 201);
  });

  it('treats a sent quote past validUntil as expired and refuses to accept it', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const request = await requestFor(builder, listing);
    const quote = await sentQuote(listing, request.id);
    await h.db
      .update(quotes)
      .set({ validUntil: dateFromToday(-1) })
      .where(eq(quotes.id, quote.id));

    const view = await h.request<QuoteDto>('GET', `/quotes/${quote.id}`, builder.token);
    assert.equal(view.body.status, 'EXPIRED');
    const res = await h.request('POST', `/quotes/${quote.id}/accept`, builder.token);
    assert.equal(res.status, 409);
    const expiredList = await h.request<QuotePageDto>(
      'GET',
      '/quotes/supplier?status=EXPIRED',
      listing.supplier.token,
    );
    assert.deepEqual(
      expiredList.body.items.map((q) => q.id),
      [quote.id],
    );
  });
});
