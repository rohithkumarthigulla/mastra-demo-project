import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import type {
  BookingDto,
  FleetCalendarDto,
  ListingAvailabilityDto,
  NotificationPageDto,
  QuoteDto,
  RentalRequestDto,
  RequirementDto,
  SendRequirementResponse,
} from '@ee/contracts';
import { eq } from 'drizzle-orm';
import {
  cities,
  equipmentCategories,
  equipmentListings,
  equipmentModels,
} from '../platform/database/schema';
import {
  dateFromToday,
  RentalFlowHarness,
  type Actor,
  type Listing,
} from '../modules/rental-requests/testing/rental-flow-test-app';

// End-to-end over HTTP against the shared dev database. Every row comes from the harness with
// a unique label and is removed after each test, so parallel suites are unaffected.
describe('rental flow (end to end)', () => {
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

  const ok = async <T>(
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    token: string,
    payload?: unknown,
    status = 200,
  ): Promise<T> => {
    const res = await h.request<T>(method, url, token, payload);
    assert.equal(
      res.status,
      status,
      `${method} ${url} → ${res.status} ${JSON.stringify(res.body)}`,
    );
    return res.body;
  };

  const inbox = (actor: Actor) =>
    ok<NotificationPageDto>('GET', '/notifications?limit=50', actor.token);

  const kinds = async (actor: Actor) => (await inbox(actor)).items.map((n) => n.kind).sort();

  const sendQuote = async (listing: Listing, requestId: string) => {
    const draft = await ok<QuoteDto>(
      'POST',
      '/quotes',
      listing.supplier.token,
      {
        rentalRequestId: requestId,
        equipmentUnitId: listing.unitIds[0],
        lines: [{ type: 'RENTAL', description: 'Excavator', quantity: 3, unitAmount: 10000 }],
      },
      201,
    );
    return ok<QuoteDto>('POST', `/quotes/${draft.id}/send`, listing.supplier.token);
  };

  const fleetSlots = async (supplier: Actor, from: string, to: string) => {
    const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const fleet = await ok<FleetCalendarDto>('GET', `/availability/fleet?${query}`, supplier.token);
    return fleet.lanes.flatMap((lane) => lane.slots.map((s) => ({ unitId: lane.unitId, ...s })));
  };

  it('runs a rental from request to return, notifying both sides and updating the calendar', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const supplier = listing.supplier;
    const startDate = dateFromToday(3);
    const endDate = dateFromToday(5);

    // Builder requests the machine; the supplier hears about it.
    const request = await ok<RentalRequestDto>(
      'POST',
      '/rental-requests',
      builder.token,
      { listingId: listing.id, startDate, endDate },
      201,
    );
    assert.equal(request.status, 'PENDING');
    assert.deepEqual(await kinds(supplier), ['REQUEST_RECEIVED']);
    const received = (await inbox(supplier)).items[0]!;
    assert.equal(received.href, `/supplier/pipeline/requests/${request.id}`);

    // Supplier opens it, which tells the builder their request was seen.
    await ok('POST', `/rental-requests/${request.id}/viewed`, supplier.token);
    assert.deepEqual(await kinds(builder), ['JOB_VIEWED']);

    // Supplier quotes; the builder sees the quote.
    const quote = await sendQuote(listing, request.id);
    assert.equal(quote.status, 'SENT');
    assert.deepEqual(await kinds(builder), ['JOB_VIEWED', 'QUOTE_RECEIVED']);
    const builderQuote = await ok<QuoteDto>('GET', `/quotes/${quote.id}`, builder.token);
    assert.equal(builderQuote.total, quote.total);

    const range = {
      from: new Date(`${startDate}T00:00:00+05:30`).toISOString(),
      to: new Date(`${dateFromToday(6)}T00:00:00+05:30`).toISOString(),
    };
    const before = await ok<ListingAvailabilityDto>(
      'GET',
      `/equipment-listings/${listing.id}/availability?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      builder.token,
    );
    assert.deepEqual(before, { totalUnits: 1, availableUnits: 1 });

    // Builder accepts: booking confirmed, both sides notified, the unit is booked on the calendar.
    const accepted = await ok<QuoteDto>('POST', `/quotes/${quote.id}/accept`, builder.token);
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.rentalRequest.status, 'ACCEPTED');
    assert.ok(accepted.bookingId);
    const bookingId = accepted.bookingId;
    assert.deepEqual(await kinds(builder), ['BOOKING_CONFIRMED', 'JOB_VIEWED', 'QUOTE_RECEIVED']);
    assert.deepEqual(await kinds(supplier), ['QUOTE_ACCEPTED', 'REQUEST_RECEIVED']);
    const won = (await inbox(supplier)).items.find((n) => n.kind === 'QUOTE_ACCEPTED')!;
    assert.equal(won.href, `/supplier/bookings/${bookingId}`);
    assert.equal(won.tone, 'good');

    const slots = await fleetSlots(supplier, range.from, range.to);
    assert.deepEqual(
      slots.map((s) => [s.unitId, s.state, s.source.id]),
      [[listing.unitIds[0], 'BOOKED', bookingId]],
    );
    const during = await ok<ListingAvailabilityDto>(
      'GET',
      `/equipment-listings/${listing.id}/availability?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      builder.token,
    );
    assert.equal(during.availableUnits, 0);

    // Supplier moves the booking through delivery, rent and return.
    for (const [action, status] of [
      ['dispatch', 'OUT_FOR_DELIVERY'],
      ['start-rent', 'ON_RENT'],
      ['complete', 'RETURNED'],
    ] as const) {
      const booking = await ok<BookingDto>(
        'POST',
        `/bookings/${bookingId}/${action}`,
        supplier.token,
      );
      assert.equal(booking.status, status);
    }
    const seen = await ok<BookingDto>('GET', `/bookings/${bookingId}`, builder.token);
    assert.equal(seen.status, 'RETURNED');
    assert.ok(seen.dispatchedAt && seen.rentStartedAt && seen.returnedAt);

    // A returned booking no longer holds the unit.
    assert.deepEqual(await fleetSlots(supplier, range.from, range.to), []);

    // Reading notifications works end to end.
    const unread = await inbox(builder);
    assert.equal(unread.unreadCount, 3);
    await ok('POST', `/notifications/${unread.items[0]!.id}/read`, builder.token);
    assert.equal((await inbox(builder)).unreadCount, 2);
    await ok('POST', '/notifications/read-all', builder.token);
    assert.equal((await inbox(builder)).unreadCount, 0);
  });

  it('fans a requirement out to three suppliers and settles the others when one wins', async () => {
    const builder = await h.builder();
    const listings = [
      await h.listing(await h.supplier('Winner')),
      await h.listing(await h.supplier('Quoted loser')),
      await h.listing(await h.supplier('Silent loser')),
    ];
    const [winner, loserA, loserB] = listings as [Listing, Listing, Listing];
    const startDate = dateFromToday(8);
    const endDate = dateFromToday(10);

    // Describe the requirement in the same category and city as the harness listings.
    const [where] = await h.db
      .select({ categoryCode: equipmentCategories.code, cityGeoId: cities.geoId })
      .from(equipmentListings)
      .innerJoin(equipmentModels, eq(equipmentModels.id, equipmentListings.modelId))
      .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipmentModels.categoryId))
      .innerJoin(cities, eq(cities.id, equipmentListings.cityId))
      .where(eq(equipmentListings.id, winner.id));

    const draft = await ok<RequirementDto>(
      'POST',
      '/requirements',
      builder.token,
      { title: 'Three excavators for the podium', ...where!, startDate, endDate },
      201,
    );
    assert.equal(draft.status, 'DRAFT');
    const sent = await ok<SendRequirementResponse>(
      'POST',
      `/requirements/${draft.id}/send`,
      builder.token,
      { listingIds: listings.map((l) => l.id) },
    );
    assert.deepEqual(sent.skipped, []);
    const requestFor = (l: Listing) => sent.sent.find((s) => s.listingId === l.id)!.rentalRequestId;
    const requirementId = draft.id;
    for (const l of listings) {
      assert.deepEqual(await kinds(l.supplier), ['REQUEST_RECEIVED']);
    }

    const winningQuote = await sendQuote(winner, requestFor(winner));
    const losingQuotes = [
      await sendQuote(loserA, requestFor(loserA)),
      await sendQuote(loserB, requestFor(loserB)),
    ];
    assert.equal((await kinds(builder)).filter((k) => k === 'QUOTE_RECEIVED').length, 3);

    await ok<QuoteDto>('POST', `/quotes/${winningQuote.id}/accept`, builder.token);

    const requirement = await ok<RequirementDto>(
      'GET',
      `/requirements/${requirementId}`,
      builder.token,
    );
    assert.equal(requirement.status, 'AWARDED');

    const status = async (l: Listing) =>
      (await ok<RentalRequestDto>('GET', `/rental-requests/${requestFor(l)}`, builder.token))
        .status;
    assert.equal(await status(winner), 'ACCEPTED');
    assert.equal(await status(loserA), 'WITHDRAWN');
    assert.equal(await status(loserB), 'WITHDRAWN');

    const kept = await ok<QuoteDto>('GET', `/quotes/${winningQuote.id}`, winner.supplier.token);
    assert.equal(kept.status, 'ACCEPTED');
    assert.ok(kept.bookingId);
    for (const [quote, loser] of [
      [losingQuotes[0]!, loserA],
      [losingQuotes[1]!, loserB],
    ] as const) {
      const lost = await ok<QuoteDto>('GET', `/quotes/${quote.id}`, loser.supplier.token);
      assert.equal(lost.status, 'EXPIRED');
      assert.deepEqual(await kinds(loser.supplier), ['QUOTE_LOST', 'REQUEST_RECEIVED']);
      const note = (await inbox(loser.supplier)).items.find((n) => n.kind === 'QUOTE_LOST')!;
      assert.equal(note.href, `/supplier/pipeline/requests/${requestFor(loser)}`);
    }
    assert.deepEqual(await kinds(winner.supplier), ['QUOTE_ACCEPTED', 'REQUEST_RECEIVED']);

    // A loser can no longer quote on the withdrawn invitation.
    const lateQuote = await h.request('POST', '/quotes', loserB.supplier.token, {
      rentalRequestId: requestFor(loserB),
      equipmentUnitId: loserB.unitIds[0],
      lines: [{ type: 'RENTAL', description: 'Too late', quantity: 1, unitAmount: 1 }],
    });
    assert.equal(lateQuote.status, 409);
  });
});
