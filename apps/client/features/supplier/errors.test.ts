import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import { supplierErrorMessage, supplierErrors } from './errors';

describe('supplierErrors', () => {
  it('maps known codes to fixed messages', () => {
    expect(supplierErrorMessage(new ApiError(409, 'block_overlap', 'x'))).toBe(
      'That machine is already blocked or booked for some of those days.',
    );
    expect(supplierErrorMessage(new ApiError(501, 'NOT_IMPLEMENTED', 'x'))).toMatch(/not live yet/);
  });

  it("shows the api's message for other domain errors", () => {
    const error = new ApiError(
      409,
      'listing_has_no_active_units',
      'Add at least one active machine to this listing before publishing it',
    );
    expect(supplierErrorMessage(error)).toBe(
      'Add at least one active machine to this listing before publishing it',
    );
  });

  it('keeps field errors from validation failures', () => {
    const error = new ApiError(400, 'validation_failed', 'bad', { 'lines.0.quantity': 'Too big' });
    expect(supplierErrors(error)).toEqual({ fields: { lines: 'Too big' } });
  });

  it('falls back to a generic message for server errors and no error at all', () => {
    expect(supplierErrorMessage(new ApiError(500, 'internal', 'boom'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(supplierErrorMessage(null)).toBeNull();
  });
});
