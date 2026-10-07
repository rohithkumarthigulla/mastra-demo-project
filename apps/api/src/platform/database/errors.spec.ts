import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findPgError, isExclusionViolation, isUniqueViolation } from './errors';

describe('pg error helpers', () => {
  const wrapped = (code: string, constraint?: string) =>
    new Error('query failed', { cause: Object.assign(new Error('pg'), { code, constraint }) });

  it('finds the driver error through drizzle cause wrapping', () => {
    assert.equal(findPgError(wrapped('23505', 'x_idx'), '23505')?.constraint, 'x_idx');
    assert.equal(findPgError(new Error('plain'), '23505'), null);
  });

  it('tells unique and exclusion violations apart', () => {
    assert.equal(isUniqueViolation(wrapped('23505')), true);
    assert.equal(isExclusionViolation(wrapped('23505')), false);
    assert.equal(isExclusionViolation(wrapped('23P01')), true);
    assert.equal(isUniqueViolation(wrapped('23P01')), false);
  });
});
