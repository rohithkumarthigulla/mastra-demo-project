import {
  bookingStatusSchema,
  quoteStatusSchema,
  rentalRequestStatusSchema,
  type QuoteStatus,
} from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import { bookingFixture, requestFixture } from './fixtures';
import {
  TRACKER_COLUMNS,
  bookingColumn,
  buildBoard,
  quoteColumn,
  requestColumn,
  summarise,
} from './tracker';

const summary = (status: QuoteStatus, total = 1000) => ({
  id: '99999999-9999-4999-8999-999999999999',
  status,
  total,
});

describe('status mapping', () => {
  it('maps every quote status', () => {
    const mapped = Object.fromEntries(quoteStatusSchema.options.map((s) => [s, quoteColumn(s)]));
    expect(mapped).toEqual({
      DRAFT: 'QUOTE_TO_SEND',
      PENDING_APPROVAL: 'QUOTE_TO_SEND',
      SENT: 'AWAITING_BUILDER',
      ACCEPTED: 'CONFIRMED',
      REJECTED: null,
      EXPIRED: null,
    });
  });

  it('maps every request status without a quote', () => {
    const mapped = Object.fromEntries(
      rentalRequestStatusSchema.options.map((s) => [s, requestColumn(s, null)]),
    );
    expect(mapped).toEqual({
      PENDING: 'NEW_REQUESTS',
      ACCEPTED: 'CONFIRMED',
      REJECTED: null,
      CANCELLED: null,
      WITHDRAWN: null,
    });
  });

  it('moves a pending request along with its quote', () => {
    expect(requestColumn('PENDING', 'DRAFT')).toBe('QUOTE_TO_SEND');
    expect(requestColumn('PENDING', 'PENDING_APPROVAL')).toBe('QUOTE_TO_SEND');
    expect(requestColumn('PENDING', 'SENT')).toBe('AWAITING_BUILDER');
    // A rejected or expired quote leaves the request needing a new quote.
    expect(requestColumn('PENDING', 'REJECTED')).toBe('NEW_REQUESTS');
    expect(requestColumn('PENDING', 'EXPIRED')).toBe('NEW_REQUESTS');
  });

  it('maps every booking status', () => {
    const mapped = Object.fromEntries(
      bookingStatusSchema.options.map((s) => [s, bookingColumn(s)]),
    );
    expect(mapped).toEqual({
      CONFIRMED: 'CONFIRMED',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      ON_RENT: 'ON_RENT',
      RETURNED: 'RETURNED',
      CANCELLED: null,
    });
  });

  it('only uses known columns', () => {
    const all = [
      ...quoteStatusSchema.options.map(quoteColumn),
      ...bookingStatusSchema.options.map(bookingColumn),
      ...rentalRequestStatusSchema.options.map((s) => requestColumn(s, null)),
    ];
    for (const column of all) {
      if (column) expect(TRACKER_COLUMNS).toContain(column);
    }
  });
});

describe('buildBoard', () => {
  it('places requests, quotes and bookings, showing a booked request once', () => {
    const fresh = requestFixture({ startDate: '2026-10-22', endDate: '2026-10-23', days: 2 });
    const drafted = requestFixture({ latestQuote: summary('PENDING_APPROVAL', 5000) });
    const sent = requestFixture({ latestQuote: summary('SENT', 7000) });
    const retry = requestFixture({ latestQuote: summary('REJECTED') });
    const accepted = requestFixture({ status: 'ACCEPTED', latestQuote: summary('ACCEPTED') });
    const declined = requestFixture({ status: 'REJECTED' });
    const withdrawn = requestFixture({ status: 'WITHDRAWN' });

    const confirmed = bookingFixture({ rentalRequestId: accepted.id, total: 73750 });
    const onRent = bookingFixture({ status: 'ON_RENT', startDate: '2026-10-01' });
    const cancelled = bookingFixture({ status: 'CANCELLED' });

    const { board, closed } = buildBoard({
      requests: [fresh, drafted, sent, retry, accepted, declined, withdrawn],
      bookings: [confirmed, onRent, cancelled],
    });

    expect(board.NEW_REQUESTS.map((c) => c.id)).toEqual([retry.id, fresh.id]);
    expect(board.NEW_REQUESTS.every((c) => c.kind === 'request' && c.amount === null)).toBe(true);
    expect(board.QUOTE_TO_SEND).toEqual([
      expect.objectContaining({ kind: 'quote', id: drafted.latestQuote!.id, amount: 5000 }),
    ]);
    expect(board.AWAITING_BUILDER).toEqual([
      expect.objectContaining({ kind: 'quote', amount: 7000 }),
    ]);
    expect(board.CONFIRMED).toEqual([
      expect.objectContaining({ kind: 'booking', id: confirmed.id, amount: 73750 }),
    ]);
    expect(board.OUT_FOR_DELIVERY).toEqual([]);
    expect(board.ON_RENT.map((c) => c.id)).toEqual([onRent.id]);
    expect(board.RETURNED).toEqual([]);
    expect(closed).toBe(3);
  });

  it('shows an accepted request whose booking is not loaded', () => {
    const accepted = requestFixture({ status: 'ACCEPTED', latestQuote: summary('ACCEPTED', 900) });
    const { board } = buildBoard({ requests: [accepted], bookings: [] });
    expect(board.CONFIRMED).toEqual([expect.objectContaining({ kind: 'quote', amount: 900 })]);
  });
});

describe('summarise', () => {
  it('counts each column and totals confirmed bookings', () => {
    const { board } = buildBoard({
      requests: [requestFixture(), requestFixture()],
      bookings: [
        bookingFixture({ total: 1000.1 }),
        bookingFixture({ total: 2000.2 }),
        bookingFixture({ status: 'RETURNED', total: 5000 }),
      ],
    });
    const result = summarise(board);
    expect(result.counts).toEqual({
      NEW_REQUESTS: 2,
      QUOTE_TO_SEND: 0,
      AWAITING_BUILDER: 0,
      CONFIRMED: 2,
      OUT_FOR_DELIVERY: 0,
      ON_RENT: 0,
      RETURNED: 1,
    });
    expect(result.confirmedValue).toBe(3000.3);
  });
});
