import type { ZodError } from 'zod';
import { ApiError } from '../../api/errors';

export type FieldErrors = Partial<Record<string, string>>;

export interface FormErrors {
  fields: FieldErrors;
  form?: string;
}

/** First message per top-level field, matching how forms render one error under each input. */
export function fieldErrorsFromZod(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    if (key) fields[key] ??= issue.message;
  }
  return fields;
}

const FORM_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_taken: 'An account with this email already exists.',
  supplier_profile_exists: 'Your supplier profile already exists.',
};

export function formErrorsFromApi(error: unknown): FormErrors {
  if (!(error instanceof ApiError)) {
    return { fields: {}, form: 'Could not reach the server. Check your connection and try again.' };
  }
  if (error.code === 'email_taken') return { fields: { email: FORM_MESSAGES.email_taken } };
  if (error.code === 'validation_failed' && error.fieldErrors) {
    const fields: FieldErrors = {};
    for (const [path, message] of Object.entries(error.fieldErrors)) {
      fields[path.split('.')[0]!] ??= message;
    }
    return { fields };
  }
  return {
    fields: {},
    form: FORM_MESSAGES[error.code] ?? 'Something went wrong. Please try again.',
  };
}
