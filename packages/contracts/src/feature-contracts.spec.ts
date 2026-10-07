import { describe, expect, it } from 'vitest';
import { cancelBookingSchema } from './booking.js';
import { calendarSlotSchema } from './availability.js';
import { rentalDays, todayInRentalZone } from './common.js';
import { notificationKindSchema } from './notification.js';
import { createQuoteSchema, updateQuoteSchema } from './quote.js';
import { createRentalRequestSchema } from './rental-request.js';
import { REQUIREMENT_MAX_SUPPLIERS, sendRequirementSchema } from './requirement.js';
import { allFeatureRoutes } from './routes.js';

const ID = '00000000-0000-4000-8000-000000000001';

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const today = todayInRentalZone();

describe('rental dates', () => {
  it('counts both ends', () => {
    expect(rentalDays('2026-01-01', '2026-01-01')).toBe(1);
    expect(rentalDays('2026-01-01', '2026-01-14')).toBe(14);
  });

  it('accepts a one-day rental starting today', () => {
    const result = createRentalRequestSchema.safeParse({
      listingId: ID,
      startDate: today,
      endDate: today,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a start date in the past', () => {
    const result = createRentalRequestSchema.safeParse({
      listingId: ID,
      startDate: addDays(today, -1),
      endDate: today,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    const result = createRentalRequestSchema.safeParse({
      listingId: ID,
      startDate: addDays(today, 2),
      endDate: addDays(today, 1),
    });
    expect(result.success).toBe(false);
  });

  it('allows 365 days but not 366', () => {
    const base = { listingId: ID, startDate: today };
    expect(
      createRentalRequestSchema.safeParse({ ...base, endDate: addDays(today, 364) }).success,
    ).toBe(true);
    expect(
      createRentalRequestSchema.safeParse({ ...base, endDate: addDays(today, 365) }).success,
    ).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    const result = createRentalRequestSchema.safeParse({
      listingId: ID,
      startDate: '2099-02-30',
      endDate: '2099-03-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('quotes', () => {
  const line = {
    type: 'RENTAL',
    description: 'Excavator, 14 days',
    quantity: 14,
    unitAmount: 9000,
  };

  it('needs at least one line', () => {
    expect(createQuoteSchema.safeParse({ rentalRequestId: ID, lines: [] }).success).toBe(false);
    expect(createQuoteSchema.safeParse({ rentalRequestId: ID, lines: [line] }).success).toBe(true);
  });

  it('enters discounts as positive amounts', () => {
    const discount = { ...line, type: 'DISCOUNT', unitAmount: -500 };
    expect(createQuoteSchema.safeParse({ rentalRequestId: ID, lines: [discount] }).success).toBe(
      false,
    );
  });

  it('rejects an empty edit', () => {
    expect(updateQuoteSchema.safeParse({}).success).toBe(false);
  });
});

describe('requirements', () => {
  it(`sends to at most ${REQUIREMENT_MAX_SUPPLIERS} unique listings`, () => {
    const ids = Array.from(
      { length: REQUIREMENT_MAX_SUPPLIERS + 1 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(sendRequirementSchema.safeParse({ listingIds: ids }).success).toBe(false);
    expect(sendRequirementSchema.safeParse({ listingIds: ids.slice(1) }).success).toBe(true);
    expect(sendRequirementSchema.safeParse({ listingIds: [ID, ID] }).success).toBe(false);
  });
});

describe('bookings', () => {
  it('requires a cancel reason', () => {
    expect(cancelBookingSchema.safeParse({}).success).toBe(false);
    expect(cancelBookingSchema.safeParse({ reason: 'Site closed' }).success).toBe(true);
  });

  it('shows booked slots on the calendar', () => {
    const slot = calendarSlotSchema.parse({
      state: 'BOOKED',
      startAt: '2026-01-01T00:00:00.000Z',
      endAt: '2026-01-02T00:00:00.000Z',
      source: { type: 'BOOKING', id: ID },
    });
    expect(slot.state).toBe('BOOKED');
  });
});

describe('notifications', () => {
  it('has four builder and four supplier kinds', () => {
    expect(notificationKindSchema.options).toHaveLength(8);
  });
});

describe('route manifest', () => {
  it('has no duplicate method and path', () => {
    const keys = allFeatureRoutes.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers every endpoint in the spec', () => {
    expect(allFeatureRoutes).toHaveLength(44);
  });
});
