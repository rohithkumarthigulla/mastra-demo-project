import { ConflictError, NotFoundError } from '../../../platform/http';

export class SupplierProfileExistsError extends ConflictError {
  constructor() {
    super('supplier_profile_exists', 'This account already has a supplier profile');
  }
}

export class SupplierProfileNotFoundError extends NotFoundError {
  constructor() {
    super('supplier_profile_not_found', 'This account has no supplier profile');
  }
}
