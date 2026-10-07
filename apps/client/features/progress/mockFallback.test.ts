import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import { isNotImplemented, isPreviewing, orMock } from './mockFallback';

const notImplemented = () => new ApiError(501, 'NOT_IMPLEMENTED', 'Not implemented');

describe('orMock', () => {
  it('returns the real response untouched', async () => {
    const real = { items: [1] };
    const value = await orMock(Promise.resolve(real), () => ({ items: [] as number[] }));
    expect(value).toBe(real);
    expect(isPreviewing()).toBe(false);
  });

  it.each([
    new ApiError(400, 'validation_failed', 'Bad'),
    new ApiError(404, 'not_found', 'Missing'),
    new ApiError(500, 'http_error', 'Boom'),
    new TypeError('Network request failed'),
  ])('rethrows %s', async (error) => {
    await expect(orMock(Promise.reject(error), () => ({}))).rejects.toBe(error);
    expect(isPreviewing()).toBe(false);
  });

  it('falls back to the mock on 501 and enters preview mode', async () => {
    const value = await orMock(Promise.reject(notImplemented()), () => ({ items: [2] }));
    expect(value).toEqual({ items: [2] });
    expect(isPreviewing()).toBe(true);
  });
});

describe('isNotImplemented', () => {
  it('only matches 501 api errors', () => {
    expect(isNotImplemented(notImplemented())).toBe(true);
    expect(isNotImplemented(new ApiError(500, 'x', 'x'))).toBe(false);
    expect(isNotImplemented(new Error('x'))).toBe(false);
  });
});
