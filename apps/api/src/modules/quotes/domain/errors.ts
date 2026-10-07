import { DomainError } from '../../../platform/http';

export class NegativeSubtotalError extends DomainError {
  constructor() {
    super('negative_subtotal', 'Discounts cannot exceed the other lines');
  }
}
