import { ApiError } from '../../api/errors';
import { formErrorsFromApi, type FormErrors } from '../auth/formErrors';

const MESSAGES: Record<string, string> = {
  NOT_IMPLEMENTED: 'This part of the marketplace is not live yet. Please try again later.',
  yard_name_taken: 'You already have a yard with this name.',
  yard_has_active_units: 'Move or retire the machines at this yard before deleting it.',
  yard_in_use: 'This yard still has machines recorded against it, so it cannot be deleted.',
  duplicate_identifier: 'Another machine already uses one of these identifiers.',
  unit_retired: 'This machine is retired and can no longer be changed.',
  block_overlap: 'That machine is already blocked or booked for some of those days.',
  block_in_past: 'Blocks must start today or later.',
  block_already_lifted: 'This block has already been lifted.',
};

/**
 * Field and form errors for a failed supplier call. Known codes get a fixed message;
 * other domain errors show the API's own message, which is written for the supplier.
 */
export function supplierErrors(error: unknown): FormErrors {
  const base = formErrorsFromApi(error);
  if (!(error instanceof ApiError) || Object.keys(base.fields).length > 0) return base;
  const known = MESSAGES[error.code];
  if (known) return { fields: {}, form: known };
  return error.status < 500 && error.code !== 'http_error'
    ? { fields: {}, form: error.message }
    : base;
}

export function supplierErrorMessage(error: unknown): string | null {
  return error ? (supplierErrors(error).form ?? null) : null;
}
