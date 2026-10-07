import { ConflictError, DomainError, NotFoundError } from '../../../platform/http';

export class NegativeSubtotalError extends DomainError {
  constructor() {
    super('negative_subtotal', 'Discounts cannot exceed the other lines');
  }
}

export class QuoteNotFoundError extends NotFoundError {
  constructor() {
    super('quote_not_found', 'Quote not found');
  }
}

export class QuoteAlreadyOpenError extends ConflictError {
  constructor() {
    super('quote_already_open', 'This request already has an open quote');
  }
}

export class QuoteNotEditableError extends ConflictError {
  constructor() {
    super('quote_not_editable', 'Only a draft or auto-drafted quote can be changed or sent');
  }
}

export class QuoteNotOpenError extends ConflictError {
  constructor() {
    super('quote_not_open', 'Only a sent, unexpired quote can be accepted or rejected');
  }
}

export class QuoteRequestClosedError extends ConflictError {
  constructor() {
    super('rental_request_not_pending', 'The rental request is no longer pending');
  }
}

export class InvalidQuoteUnitError extends DomainError {
  constructor() {
    super('invalid_equipment_unit', "The machine must be an active unit on the request's listing");
  }
}

export class IncompleteQuoteError extends DomainError {
  constructor(message: string) {
    super('quote_incomplete', message);
  }
}

export class QuoteExpiredValidityError extends DomainError {
  constructor() {
    super('invalid_valid_until', 'validUntil cannot be in the past');
  }
}

export class UnitUnavailableError extends ConflictError {
  constructor() {
    super('unit_unavailable', 'The machine is not free for those dates');
  }
}
