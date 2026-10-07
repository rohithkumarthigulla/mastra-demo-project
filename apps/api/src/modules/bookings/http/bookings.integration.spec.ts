import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import type {
  BookingDto,
  BookingPageDto,
  ListingAvailabilityDto,
  QuoteDto,
  RentalRequestDto,
  UnitCalendarDto,
} from '@ee/contracts';
import {
  dateFromToday,
  RentalFlowHarness,
  type Actor,
  type Listing,
} from '../../rental-requests/testing/rental-flow-test-app';
import { rentalRange } from '../domain';

describe('bookings (database)', () => {
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

  /** Request → quote → send → accept; returns the confirmed booking. */
  const book = async (builder: Actor, listing: Listing, start = 2, end = 4) => {
    const request = await h.request<RentalRequestDto>('POST', '/rental-requests', builder.token, {
      listingId: listing.id,
      startDate: dateFromToday(start),
      endDate: dateFromToday(end),
    });
    assert.equal(request.status, 201);
    const quote = await h.request<QuoteDto>('POST', '/quotes', listing.supplier.token, {
      rentalRequestId: request.body.id,
      equipmentUnitId: listing.unitIds[0],
      lines: [{ type: 'RENTAL', description: 'Rental', quantity: 3, unitAmount: 10000 }],
    });
    assert.equal(quote.status, 201);
    const s = listing.supplier.token;
    assert.equal((await h.request('POST', `/quotes/${quote.body.id}/send`, s)).status, 200);
    const accepted = await h.request<QuoteDto>(
      'POST',
      `/quotes/${quote.body.id}/accept`,
      builder.token,
    );
    assert.equal(accepted.status, 200);
    const booking = await h.request<BookingDto>(
      'GET',
      `/bookings/${accepted.body.bookingId}`,
      builder.token,
    );
    assert.equal(booking.status, 200);
    return booking.body;
  };

  const step = (token: string, id: string, action: string, payload?: unknown) =>
    h.request<BookingDto>('POST', `/bookings/${id}/${action}`, token, payload);

  it('runs a booking through dispatch, rent and return, stamping each step', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const booking = await book(builder, listing);

    const range = rentalRange(dateFromToday(2), dateFromToday(4));
    assert.equal(booking.status, 'CONFIRMED');
    assert.equal(booking.startDate, dateFromToday(2));
    assert.equal(booking.endDate, dateFromToday(4));
    assert.equal(booking.days, 3);
    assert.equal(booking.startAt, range.start.toISOString());
    assert.equal(booking.endAt, range.end.toISOString());
    assert.equal(booking.total, 35400);
    assert.equal(booking.equipmentUnitId, listing.unitIds[0]);
    assert.equal(typeof booking.listing.city, 'string');
    assert.equal(booking.dispatchedAt, null);

    const s = listing.supplier.token;
    // Out of order steps are conflicts.
    assert.equal((await step(s, booking.id, 'start-rent')).status, 409);
    assert.equal((await step(s, booking.id, 'complete')).status, 409);

    const dispatched = await step(s, booking.id, 'dispatch');
    assert.equal(dispatched.status, 200);
    assert.equal(dispatched.body.status, 'OUT_FOR_DELIVERY');
    assert.ok(dispatched.body.dispatchedAt);
    assert.equal((await step(s, booking.id, 'dispatch')).status, 409);

    const onRent = await step(s, booking.id, 'start-rent');
    assert.equal(onRent.body.status, 'ON_RENT');
    assert.ok(onRent.body.rentStartedAt);
    // A machine on site cannot be cancelled.
    assert.equal((await step(s, booking.id, 'cancel', { reason: 'Changed mind' })).status, 409);

    const returned = await step(s, booking.id, 'complete');
    assert.equal(returned.body.status, 'RETURNED');
    assert.ok(returned.body.returnedAt);
    assert.equal((await step(s, booking.id, 'complete')).status, 409);
  });

  it('lets either party cancel a confirmed or dispatched booking, with a reason', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const first = await book(builder, listing, 2, 3);
    const second = await book(builder, listing, 6, 7);

    assert.equal((await step(builder.token, first.id, 'cancel', {})).status, 400);
    const byBuilder = await step(builder.token, first.id, 'cancel', { reason: 'Site delayed' });
    assert.equal(byBuilder.status, 200);
    assert.equal(byBuilder.body.status, 'CANCELLED');
    assert.equal(byBuilder.body.cancelReason, 'Site delayed');
    assert.ok(byBuilder.body.cancelledAt);
    assert.equal((await step(builder.token, first.id, 'cancel', { reason: 'Again' })).status, 409);

    const s = listing.supplier.token;
    assert.equal((await step(s, second.id, 'dispatch')).status, 200);
    const bySupplier = await step(s, second.id, 'cancel', { reason: 'Breakdown on the way' });
    assert.equal(bySupplier.body.status, 'CANCELLED');
    assert.ok(bySupplier.body.dispatchedAt);
  });

  it('shows a booking only to its builder and supplier', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier());
    const booking = await book(builder, listing);
    const strangerB = await h.builder('Stranger B');
    const strangerS = await h.supplier('Stranger S');

    assert.equal((await h.request('GET', `/bookings/${booking.id}`, strangerB.token)).status, 404);
    assert.equal((await h.request('GET', `/bookings/${booking.id}`, strangerS.token)).status, 404);
    assert.equal((await step(strangerS.token, booking.id, 'dispatch')).status, 404);
    assert.equal(
      (await step(strangerB.token, booking.id, 'cancel', { reason: 'Nope' })).status,
      404,
    );

    const mine = await h.request<BookingPageDto>('GET', '/bookings/builder', builder.token);
    assert.deepEqual(
      mine.body.items.map((b) => b.id),
      [booking.id],
    );
    const theirs = await h.request<BookingPageDto>(
      'GET',
      '/bookings/supplier?status=CONFIRMED',
      listing.supplier.token,
    );
    assert.equal(theirs.body.total, 1);
    const none = await h.request<BookingPageDto>(
      'GET',
      '/bookings/supplier?status=RETURNED',
      listing.supplier.token,
    );
    assert.equal(none.body.total, 0);
    const empty = await h.request<BookingPageDto>('GET', '/bookings/builder', strangerB.token);
    assert.equal(empty.body.total, 0);
  });

  it('marks a booked machine BOOKED in calendars, refuses blocks over it, and frees it on cancel', async () => {
    const builder = await h.builder();
    const listing = await h.listing(await h.supplier(), { units: 1 });
    const booking = await book(builder, listing, 2, 4);
    const unitId = listing.unitIds[0]!;
    const s = listing.supplier.token;
    const window = `from=${encodeURIComponent(
      rentalRange(dateFromToday(1), dateFromToday(1)).start.toISOString(),
    )}&to=${encodeURIComponent(
      rentalRange(dateFromToday(10), dateFromToday(10)).start.toISOString(),
    )}`;

    const calendar = await h.request<UnitCalendarDto>(
      'GET',
      `/availability/units/${unitId}?${window}`,
      s,
    );
    assert.equal(calendar.status, 200);
    assert.deepEqual(calendar.body.slots, [
      {
        state: 'BOOKED',
        startAt: booking.startAt,
        endAt: booking.endAt,
        source: { type: 'BOOKING', id: booking.id },
      },
    ]);
    const fleet = await h.request<{ lanes: UnitCalendarDto[] }>(
      'GET',
      `/availability/fleet?${window}`,
      s,
    );
    assert.equal(fleet.body.lanes.find((l) => l.unitId === unitId)!.slots[0]!.state, 'BOOKED');

    const publicView = await h.request<ListingAvailabilityDto>(
      'GET',
      `/equipment-listings/${listing.id}/availability?${window}`,
    );
    assert.equal(publicView.status, 200);
    assert.equal(publicView.body.availableUnits, 0);

    const overBooking = await h.request<{ code: string }>(
      'POST',
      `/availability/units/${unitId}/blocks`,
      s,
      {
        reason: 'MAINTENANCE',
        startAt: rentalRange(dateFromToday(3), dateFromToday(3)).start.toISOString(),
        endAt: rentalRange(dateFromToday(5), dateFromToday(5)).start.toISOString(),
      },
    );
    assert.equal(overBooking.status, 409);
    assert.equal(overBooking.body.code, 'block_over_booking');

    // The machine is taken, so a new request for the same dates is refused.
    const another = await h.builder('Another');
    const refused = await h.request('POST', '/rental-requests', another.token, {
      listingId: listing.id,
      startDate: dateFromToday(3),
      endDate: dateFromToday(3),
    });
    assert.equal(refused.status, 409);

    assert.equal((await step(s, booking.id, 'cancel', { reason: 'Machine sold' })).status, 200);
    const freed = await h.request<UnitCalendarDto>(
      'GET',
      `/availability/units/${unitId}?${window}`,
      s,
    );
    assert.deepEqual(freed.body.slots, []);
  });
});
