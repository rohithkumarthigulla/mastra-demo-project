import { ConflictError, DomainError, NotFoundError } from '../../../platform/http';
import type { ListingAction, ListingStatus } from './listing';

export class ListingNotFoundError extends NotFoundError {
  constructor() {
    super('listing_not_found', 'Listing not found');
  }
}

export class InvalidListingTransitionError extends ConflictError {
  constructor(action: ListingAction, status: ListingStatus) {
    super('invalid_listing_transition', `Cannot ${action} a listing that is ${status}`);
  }
}

export class SupplierProfileRequiredError extends ConflictError {
  constructor() {
    super('supplier_profile_required', 'Create a supplier profile before managing listings');
  }
}

export class InvalidCityError extends DomainError {
  constructor() {
    super('invalid_city', 'City is unknown or not enabled');
  }
}

export class InvalidModelError extends DomainError {
  constructor() {
    super('invalid_model', 'Equipment model is unknown or not active');
  }
}
