import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BookingStatus } from '@ee/contracts';
import { nextBookingStatus, rentalDate, rentalRange, type BookingAction } from './booking';

const STATUSES: BookingStatus[] = [
  'CONFIRMED',
  'OUT_FOR_DELIVERY',
  'ON_RENT',
  'RETURNED',
  'CANCELLED',
];
const ALLOWED: Record<BookingAction, Partial<Record<BookingStatus, BookingStatus>>> = {
  dispatch: { CONFIRMED: 'OUT_FOR_DELIVERY' },
  'start-rent': { OUT_FOR_DELIVERY: 'ON_RENT' },
  complete: { ON_RENT: 'RETURNED' },
  cancel: { CONFIRMED: 'CANCELLED', OUT_FOR_DELIVERY: 'CANCELLED' },
};

describe('booking state machine', () => {
  for (const [action, moves] of Object.entries(ALLOWED) as [
    BookingAction,
    typeof ALLOWED.dispatch,
  ][]) {
    for (const from of STATUSES) {
      const expected = moves[from] ?? null;
      it(`${action} from ${from} → ${expected ?? 'refused'}`, () => {
        assert.equal(nextBookingStatus(from, action), expected);
      });
    }
  }
});

describe('rental date ranges', () => {
  it('covers both dates as a half-open range in Asia/Kolkata', () => {
    const range = rentalRange('2026-11-01', '2026-11-03');
    assert.equal(range.start.toISOString(), '2026-10-31T18:30:00.000Z');
    assert.equal(range.end.toISOString(), '2026-11-03T18:30:00.000Z');
    assert.equal(rentalDate(range.start), '2026-11-01');
    assert.equal(rentalDate(new Date(range.end.getTime() - 1)), '2026-11-03');
  });

  it('a one-day rental spans exactly 24 hours', () => {
    const range = rentalRange('2026-11-01', '2026-11-01');
    assert.equal(range.end.getTime() - range.start.getTime(), 86_400_000);
  });
});
