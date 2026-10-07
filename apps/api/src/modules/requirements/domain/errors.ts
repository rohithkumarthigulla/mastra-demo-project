import { REQUIREMENT_MAX_SUPPLIERS } from '@ee/contracts';
import { ConflictError, DomainError, NotFoundError } from '../../../platform/http';

export class RequirementNotFoundError extends NotFoundError {
  constructor() {
    super('requirement_not_found', 'Requirement not found');
  }
}

export class RequirementNotDraftError extends ConflictError {
  constructor() {
    super('requirement_not_draft', 'Only a DRAFT requirement can be edited');
  }
}

export class RequirementClosedError extends ConflictError {
  constructor() {
    super('requirement_closed', 'The requirement is no longer DRAFT or OPEN');
  }
}

export class RequirementAwardedError extends ConflictError {
  constructor() {
    super('requirement_awarded', 'An awarded requirement cannot be cancelled');
  }
}

export class SupplierLimitExceededError extends ConflictError {
  constructor(remaining: number) {
    super(
      'supplier_limit_exceeded',
      `A requirement can be sent to at most ${REQUIREMENT_MAX_SUPPLIERS} suppliers; ${remaining} invitation(s) left`,
    );
  }
}

/** A category, model, task or city in the body that does not exist or is not usable. */
export class InvalidReferenceError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
