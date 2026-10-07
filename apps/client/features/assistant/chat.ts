import { ApiError } from '../../api/errors';

export const NOT_CONFIGURED_MESSAGE = 'The assistant is not set up on this server';

export function isNotConfigured(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'ASSISTANT_NOT_CONFIGURED';
}

/** A message a person can act on for any error from the assistant or agent endpoints. */
export function chatErrorMessage(error: unknown): string {
  if (isNotConfigured(error)) return NOT_CONFIGURED_MESSAGE;
  if (error instanceof ApiError) {
    if (error.code === 'ASSISTANT_UNAVAILABLE') {
      return 'The assistant is temporarily unavailable. Please try again.';
    }
    if (error.status === 404) return 'This conversation could not be found.';
    if (error.status >= 500) return 'Something went wrong. Please try again.';
    return error.message;
  }
  return 'Could not reach the server. Check your connection and try again.';
}

/** "9:05" for the time left on a pending action, or null once it has run out. */
export function formatCountdown(expiresAt: string, now: number): string | null {
  const left = Math.ceil((Date.parse(expiresAt) - now) / 1000);
  if (!(left > 0)) return null;
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
