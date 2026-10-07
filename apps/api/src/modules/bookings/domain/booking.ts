import type { BookingStatus, CalendarDate } from '@ee/contracts';

export type BookingAction = 'dispatch' | 'start-rent' | 'complete' | 'cancel';

const TRANSITIONS: Record<BookingAction, { from: readonly BookingStatus[]; to: BookingStatus }> = {
  dispatch: { from: ['CONFIRMED'], to: 'OUT_FOR_DELIVERY' },
  'start-rent': { from: ['OUT_FOR_DELIVERY'], to: 'ON_RENT' },
  complete: { from: ['ON_RENT'], to: 'RETURNED' },
  cancel: { from: ['CONFIRMED', 'OUT_FOR_DELIVERY'], to: 'CANCELLED' },
};

/** The status `action` moves a booking to, or `null` when not allowed from `current`. */
export function nextBookingStatus(
  current: BookingStatus,
  action: BookingAction,
): BookingStatus | null {
  const rule = TRANSITIONS[action];
  return rule.from.includes(current) ? rule.to : null;
}

/** Asia/Kolkata is a fixed UTC+05:30 with no daylight saving. */
const KOLKATA_OFFSET = '+05:30';
const DAY_MS = 86_400_000;

/** Midnight in Asia/Kolkata at the start of `date`. */
export function startOfRentalDay(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00${KOLKATA_OFFSET}`);
}

/** Half-open `[start, end)` covering both calendar dates inclusive. */
export function rentalRange(
  startDate: CalendarDate,
  endDate: CalendarDate,
): { start: Date; end: Date } {
  return {
    start: startOfRentalDay(startDate),
    end: new Date(startOfRentalDay(endDate).getTime() + DAY_MS),
  };
}

/** The Asia/Kolkata calendar date containing `instant`. */
export function rentalDate(instant: Date): CalendarDate {
  return new Date(instant.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}
