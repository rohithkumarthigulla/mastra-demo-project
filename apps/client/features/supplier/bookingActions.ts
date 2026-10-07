import { CANCELLABLE_BOOKING_STATUSES, type BookingStatus } from '@ee/contracts';

export type BookingAction = 'dispatch' | 'startRent' | 'complete';

export interface BookingStep {
  action: BookingAction;
  title: string;
  confirm: string;
}

const STEPS: Partial<Record<BookingStatus, BookingStep>> = {
  CONFIRMED: {
    action: 'dispatch',
    title: 'Dispatch',
    confirm: 'Mark this machine as out for delivery?',
  },
  OUT_FOR_DELIVERY: {
    action: 'startRent',
    title: 'Start rent',
    confirm: 'Confirm the machine has been delivered and the rental has started?',
  },
  ON_RENT: {
    action: 'complete',
    title: 'Complete',
    confirm: 'Confirm the machine has been returned and close this booking?',
  },
};

/** The single next step for a booking at this stage, or null when there is none. */
export function nextBookingStep(status: BookingStatus): BookingStep | null {
  return STEPS[status] ?? null;
}

export function canCancelBooking(status: BookingStatus): boolean {
  return (CANCELLABLE_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);
}
