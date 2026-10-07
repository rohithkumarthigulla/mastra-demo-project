import { ConflictError, NotFoundError } from '../../../platform/http';

export class RentalRequestNotFoundError extends NotFoundError {
  constructor() {
    super('rental_request_not_found', 'Rental request not found');
  }
}

export class RentalListingNotFoundError extends NotFoundError {
  constructor() {
    super('listing_not_found', 'Listing not found');
  }
}

export class NoUnitAvailableError extends ConflictError {
  constructor() {
    super('no_unit_available', 'No machine on this listing is free for those dates');
  }
}

export class DuplicateRentalRequestError extends ConflictError {
  constructor() {
    super(
      'duplicate_rental_request',
      'You already have a pending request for this listing on overlapping dates',
    );
  }
}

export class RentalRequestNotPendingError extends ConflictError {
  constructor() {
    super('rental_request_not_pending', 'Only a pending request can be changed');
  }
}
