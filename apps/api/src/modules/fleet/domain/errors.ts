import { ConflictError, DomainError, NotFoundError } from '../../../platform/http';

export class YardNotFoundError extends NotFoundError {
  constructor() {
    super('yard_not_found', 'Yard not found');
  }
}

export class UnitNotFoundError extends NotFoundError {
  constructor() {
    super('unit_not_found', 'Machine not found');
  }
}

/** The listing is unknown or belongs to another supplier. */
export class UnitListingNotFoundError extends NotFoundError {
  constructor() {
    super('listing_not_found', 'Listing not found');
  }
}

export class YardNameTakenError extends ConflictError {
  constructor() {
    super('yard_name_taken', 'You already have a yard with this name');
  }
}

export class YardHasActiveUnitsError extends ConflictError {
  constructor() {
    super('yard_has_active_units', 'Move or retire the machines in this yard before deleting it');
  }
}

export class YardInUseError extends ConflictError {
  constructor() {
    super('yard_in_use', 'Yard still has retired machines kept for history');
  }
}

export class DuplicateIdentifierError extends ConflictError {
  constructor() {
    super('duplicate_identifier', 'Another machine in your fleet already has this identifier');
  }
}

export class UnitRetiredError extends ConflictError {
  constructor() {
    super('unit_retired', 'This machine is retired');
  }
}

export class FleetProfileRequiredError extends ConflictError {
  constructor() {
    super('supplier_profile_required', 'Create a supplier profile before managing your fleet');
  }
}

export class FleetInvalidCityError extends DomainError {
  constructor() {
    super('invalid_city', 'City is unknown or not enabled');
  }
}
