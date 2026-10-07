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

export class ListingHasNoActiveUnitsError extends ConflictError {
  constructor() {
    super(
      'listing_has_no_active_units',
      'Add at least one active machine to this listing before publishing it',
    );
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

export class UnsupportedMediaTypeError extends DomainError {
  constructor() {
    super('unsupported_media_type', 'Photos must be JPEG, PNG or WebP', 415);
  }
}

export class MediaTooLargeError extends DomainError {
  constructor(maxBytes: number) {
    const mb = Math.round((maxBytes / (1024 * 1024)) * 100) / 100;
    super('media_too_large', `Photos can be at most ${mb} MB`, 413);
  }
}

export class MediaLimitReachedError extends ConflictError {
  constructor(max: number) {
    super('media_limit_reached', `A listing can have at most ${max} photos`);
  }
}

export class MediaNotFoundError extends NotFoundError {
  constructor() {
    super('media_not_found', 'Photo not found');
  }
}

export class InvalidMediaOrderError extends DomainError {
  constructor() {
    super('invalid_media_order', "mediaIds must list each of the listing's photos exactly once");
  }
}

export class MissingFileError extends DomainError {
  constructor() {
    super('file_required', 'Send one photo as a multipart file field');
  }
}

export class InvalidUploadError extends DomainError {
  constructor(message: string) {
    super('invalid_upload', message);
  }
}
