import { ConflictError, DomainError, NotFoundError } from '../../../platform/http';

export class CategoryExistsError extends ConflictError {
  constructor() {
    super('category_exists', 'An equipment category with this code already exists');
  }
}

export class ManufacturerExistsError extends ConflictError {
  constructor() {
    super('manufacturer_exists', 'A manufacturer with this name already exists');
  }
}

export class DefinitionExistsError extends ConflictError {
  constructor() {
    super('definition_exists', 'A specification definition with this code already exists');
  }
}

export class ModelExistsError extends ConflictError {
  constructor() {
    super('model_exists', 'This manufacturer already has a model with this name');
  }
}

export class SpecificationExistsError extends ConflictError {
  constructor() {
    super('specification_exists', 'This model already has a value for this specification');
  }
}

export class SourceNotFoundError extends NotFoundError {
  constructor() {
    super('source_not_found', 'Specification source not found');
  }
}

export class CategoryNotFoundError extends NotFoundError {
  constructor() {
    super('category_not_found', 'Equipment category not found');
  }
}

export class ManufacturerNotFoundError extends NotFoundError {
  constructor() {
    super('manufacturer_not_found', 'Manufacturer not found');
  }
}

export class DefinitionNotFoundError extends NotFoundError {
  constructor() {
    super('definition_not_found', 'Specification definition not found');
  }
}

export class ModelNotFoundError extends NotFoundError {
  constructor() {
    super('model_not_found', 'Equipment model not found');
  }
}

export class SpecificationNotFoundError extends NotFoundError {
  constructor() {
    super('specification_not_found', 'Specification not found on this model');
  }
}

export class IncompatibleUnitError extends DomainError {
  constructor(from: string, to: string) {
    super('incompatible_unit', `Unit ${from} cannot be converted to ${to}`);
  }
}

export class InvalidSpecificationShapeError extends DomainError {
  constructor(message: string) {
    super('invalid_specification_shape', message);
  }
}

export class InvalidSpecificationValueError extends DomainError {
  constructor(message: string) {
    super('invalid_specification_value', message);
  }
}

export class InvalidSpecificationRangeError extends DomainError {
  constructor() {
    super('invalid_specification_range', 'minValue must not be greater than maxValue');
  }
}

export class InvalidVerificationStatusError extends DomainError {
  constructor(message: string) {
    super('invalid_verification_status', message);
  }
}

export class VerificationSourceRequiredError extends DomainError {
  constructor() {
    super('verification_source_required', 'A VERIFIED value needs a source');
  }
}

export class TestFixtureNotVerifiableError extends DomainError {
  constructor() {
    super('test_fixture_not_verifiable', 'A value from a TEST_FIXTURE source cannot be VERIFIED');
  }
}
