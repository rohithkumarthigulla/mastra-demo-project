import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import { chatErrorMessage, formatCountdown, isNotConfigured, NOT_CONFIGURED_MESSAGE } from './chat';

describe('chatErrorMessage', () => {
  it('explains a server without an AI key', () => {
    const error = new ApiError(503, 'ASSISTANT_NOT_CONFIGURED', 'whatever');
    expect(isNotConfigured(error)).toBe(true);
    expect(chatErrorMessage(error)).toBe(NOT_CONFIGURED_MESSAGE);
  });

  it('asks for a retry when the provider is down or the server fails', () => {
    expect(chatErrorMessage(new ApiError(503, 'ASSISTANT_UNAVAILABLE', 'x'))).toMatch(/try again/);
    expect(chatErrorMessage(new ApiError(500, 'internal', 'stack trace'))).toMatch(/try again/);
  });

  it('passes through client errors such as an expired action', () => {
    const error = new ApiError(409, 'pending_action_expired', 'This change expired');
    expect(isNotConfigured(error)).toBe(false);
    expect(chatErrorMessage(error)).toBe('This change expired');
  });

  it('reports network failures', () => {
    expect(chatErrorMessage(new TypeError('Failed to fetch'))).toMatch(/connection/);
  });
});

describe('formatCountdown', () => {
  const expiresAt = '2026-01-01T00:10:00.000Z';
  const at = (iso: string) => Date.parse(iso);

  it('shows minutes and padded seconds', () => {
    expect(formatCountdown(expiresAt, at('2026-01-01T00:00:00Z'))).toBe('10:00');
    expect(formatCountdown(expiresAt, at('2026-01-01T00:09:55.500Z'))).toBe('0:05');
  });

  it('returns null once expired or for a bad date', () => {
    expect(formatCountdown(expiresAt, at('2026-01-01T00:10:00Z'))).toBeNull();
    expect(formatCountdown('nope', 0)).toBeNull();
  });
});
