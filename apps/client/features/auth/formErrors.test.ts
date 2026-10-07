import { loginRequestSchema } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import { fieldErrorsFromZod, formErrorsFromApi } from './formErrors';

describe('fieldErrorsFromZod', () => {
  it('keeps the first message for each field', () => {
    const result = loginRequestSchema.safeParse({ email: 'nope', password: '', client: 'web' });
    expect(result.success).toBe(false);
    const fields = fieldErrorsFromZod(result.error!);
    expect(Object.keys(fields).sort()).toEqual(['email', 'password']);
  });
});

describe('formErrorsFromApi', () => {
  it('shows bad credentials as a form-level error', () => {
    const errors = formErrorsFromApi(new ApiError(401, 'invalid_credentials', 'x'));
    expect(errors).toEqual({ fields: {}, form: 'Email or password is incorrect.' });
  });

  it('attaches a taken email to the email field', () => {
    const errors = formErrorsFromApi(new ApiError(409, 'email_taken', 'x'));
    expect(errors.fields.email).toMatch(/already exists/);
    expect(errors.form).toBeUndefined();
  });

  it('maps server validation errors to top-level fields', () => {
    const errors = formErrorsFromApi(
      new ApiError(400, 'validation_failed', 'x', { 'displayName.0': 'Too short' }),
    );
    expect(errors.fields).toEqual({ displayName: 'Too short' });
  });

  it('treats non-API failures as connectivity problems', () => {
    expect(formErrorsFromApi(new TypeError('Failed to fetch')).form).toMatch(/reach the server/);
  });
});
