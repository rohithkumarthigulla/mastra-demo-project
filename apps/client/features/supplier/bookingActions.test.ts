import { bookingStatusSchema } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import { canCancelBooking, nextBookingStep } from './bookingActions';

describe('booking actions', () => {
  it('walks a booking through its stages', () => {
    const steps = Object.fromEntries(
      bookingStatusSchema.options.map((s) => [s, nextBookingStep(s)?.action ?? null]),
    );
    expect(steps).toEqual({
      CONFIRMED: 'dispatch',
      OUT_FOR_DELIVERY: 'startRent',
      ON_RENT: 'complete',
      RETURNED: null,
      CANCELLED: null,
    });
  });

  it('allows cancelling only before the rent starts', () => {
    const cancellable = bookingStatusSchema.options.filter(canCancelBooking);
    expect(cancellable).toEqual(['CONFIRMED', 'OUT_FOR_DELIVERY']);
  });
});
