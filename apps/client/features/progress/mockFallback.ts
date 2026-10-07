import { useSyncExternalStore } from 'react';
import { ApiError } from '../../api/errors';

// Query caches copy data, so "this value is a mock" can't ride on object identity.
// Instead, any fallback switches the whole session into preview mode.
let previewing = false;
const listeners = new Set<() => void>();

function markPreview() {
  if (previewing) return;
  previewing = true;
  for (const listener of listeners) listener();
}

/** True when the api answered with the `501 NOT_IMPLEMENTED` stub. */
export function isNotImplemented(error: unknown): boolean {
  return error instanceof ApiError && error.status === 501;
}

/**
 * Resolves `promise`, or `mock()` when the endpoint is still a 501 stub. Every other
 * error is rethrown so real failures still surface.
 */
export async function orMock<T>(promise: Promise<T>, mock: () => T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (!isNotImplemented(error)) throw error;
    markPreview();
    return mock();
  }
}

export function isPreviewing(): boolean {
  return previewing;
}

/** Re-renders when the first mocked response arrives. */
export function usePreviewing(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isPreviewing,
    isPreviewing,
  );
}
