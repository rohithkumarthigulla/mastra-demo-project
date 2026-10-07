import { ConflictError, NotFoundError } from '../../../platform/http';

export class BookingNotFoundError extends NotFoundError {
  constructor() {
    super('booking_not_found', 'Booking not found');
  }
}

export class InvalidBookingTransitionError extends ConflictError {
  constructor() {
    super('invalid_booking_transition', 'The booking cannot make that change from its status');
  }
}
