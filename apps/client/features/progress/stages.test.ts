import {
  bookingStatusSchema,
  quoteStatusSchema,
  rentalRequestStatusSchema,
  requirementStatusSchema,
  type QuoteStatus,
} from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import {
  BOOKING_STATUS,
  bookingStage,
  bookingTimeline,
  QUOTE_STATUS,
  REQUEST_STATUS,
  requestStage,
  requestTimeline,
  REQUIREMENT_STATUS,
  STAGES,
  stageIndex,
} from './stages';

const quote = (status: QuoteStatus) => ({
  id: '00000000-0000-4000-8000-000000000001',
  status,
  total: 100,
});

describe('requestStage', () => {
  it.each([
    ['PENDING', null, { current: 'requested', closed: null }],
    ['PENDING', 'DRAFT', { current: 'requested', closed: null }],
    ['PENDING', 'PENDING_APPROVAL', { current: 'requested', closed: null }],
    ['PENDING', 'SENT', { current: 'quoted', closed: null }],
    ['PENDING', 'EXPIRED', { current: 'quoted', closed: null }],
    ['ACCEPTED', 'ACCEPTED', { current: 'booked', closed: null }],
    ['REJECTED', null, { current: 'requested', closed: 'Declined' }],
    ['CANCELLED', 'SENT', { current: 'quoted', closed: 'Cancelled' }],
    ['WITHDRAWN', 'REJECTED', { current: 'quoted', closed: 'Withdrawn' }],
  ] as const)('%s with quote %s', (status, quoteStatus, expected) => {
    expect(requestStage({ status, latestQuote: quoteStatus ? quote(quoteStatus) : null })).toEqual(
      expected,
    );
  });

  it('handles every request status', () => {
    for (const status of rentalRequestStatusSchema.options) {
      expect(
        stageIndex(requestStage({ status, latestQuote: null }).current),
      ).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('bookingStage', () => {
  it.each([
    ['CONFIRMED', null, { current: 'booked', closed: null }],
    ['OUT_FOR_DELIVERY', '2026-10-01T00:00:00.000Z', { current: 'out_for_delivery', closed: null }],
    ['ON_RENT', '2026-10-01T00:00:00.000Z', { current: 'on_rent', closed: null }],
    ['RETURNED', '2026-10-01T00:00:00.000Z', { current: 'returned', closed: null }],
    ['CANCELLED', null, { current: 'booked', closed: 'Cancelled' }],
    ['CANCELLED', '2026-10-01T00:00:00.000Z', { current: 'out_for_delivery', closed: 'Cancelled' }],
  ] as const)('%s (dispatched %s)', (status, dispatchedAt, expected) => {
    expect(bookingStage({ status, dispatchedAt })).toEqual(expected);
  });

  it('handles every booking status', () => {
    for (const status of bookingStatusSchema.options) {
      expect(bookingStage({ status, dispatchedAt: null }).current).toBeDefined();
    }
  });
});

describe('requestTimeline', () => {
  const base = {
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-03T10:00:00.000Z',
    viewedAt: null,
    latestQuote: null,
  };

  it('only has the creation step for a fresh request', () => {
    expect(requestTimeline({ ...base, status: 'PENDING' })).toEqual([
      { label: 'Request sent', at: base.createdAt },
    ]);
  });

  it('adds viewed, quote and the final status in order', () => {
    expect(
      requestTimeline({
        ...base,
        status: 'ACCEPTED',
        viewedAt: '2026-10-02T10:00:00.000Z',
        latestQuote: quote('ACCEPTED'),
      }),
    ).toEqual([
      { label: 'Request sent', at: base.createdAt },
      { label: 'Viewed by supplier', at: '2026-10-02T10:00:00.000Z' },
      { label: 'Quote received', at: null },
      { label: 'Quote accepted — booked', at: base.updatedAt },
    ]);
  });

  it('hides draft quotes', () => {
    const entries = requestTimeline({ ...base, status: 'PENDING', latestQuote: quote('DRAFT') });
    expect(entries).toHaveLength(1);
  });

  it('describes every terminal status', () => {
    for (const status of rentalRequestStatusSchema.options) {
      const entries = requestTimeline({ ...base, status });
      expect(entries.length).toBe(status === 'PENDING' ? 1 : 2);
    }
  });
});

describe('bookingTimeline', () => {
  it('lists the steps that happened, including the cancel reason', () => {
    expect(
      bookingTimeline({
        createdAt: '2026-10-01T00:00:00.000Z',
        dispatchedAt: '2026-10-02T00:00:00.000Z',
        rentStartedAt: null,
        returnedAt: null,
        cancelledAt: '2026-10-03T00:00:00.000Z',
        cancelReason: 'Site closed',
      }).map((entry) => entry.label),
    ).toEqual(['Booking confirmed', 'Out for delivery', 'Cancelled: Site closed']);
  });
});

describe('status labels', () => {
  it('cover every enum value', () => {
    for (const s of rentalRequestStatusSchema.options) expect(REQUEST_STATUS[s].label).toBeTruthy();
    for (const s of quoteStatusSchema.options) expect(QUOTE_STATUS[s].label).toBeTruthy();
    for (const s of bookingStatusSchema.options) expect(BOOKING_STATUS[s].label).toBeTruthy();
    for (const s of requirementStatusSchema.options) {
      expect(REQUIREMENT_STATUS[s].label).toBeTruthy();
    }
  });

  it('keeps stage keys unique', () => {
    expect(new Set(STAGES.map((s) => s.key)).size).toBe(STAGES.length);
  });
});
