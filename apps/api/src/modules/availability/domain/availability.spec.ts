import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertBlockNotInPast, overlaps } from './availability';
import { BlockInPastError } from './errors';

const at = (hour: number) => new Date(Date.UTC(2026, 1, 1, hour));
const range = (start: number, end: number) => ({ start: at(start), end: at(end) });

describe('overlaps (half-open ranges)', () => {
  it('treats touching ranges as free', () => {
    assert.equal(overlaps(range(8, 10), range(10, 12)), false);
    assert.equal(overlaps(range(10, 12), range(8, 10)), false);
  });

  it('detects partial, containing and identical overlaps', () => {
    assert.equal(overlaps(range(8, 11), range(10, 12)), true);
    assert.equal(overlaps(range(8, 14), range(10, 12)), true);
    assert.equal(overlaps(range(10, 12), range(10, 12)), true);
  });

  it('ignores disjoint ranges', () => {
    assert.equal(overlaps(range(8, 9), range(10, 12)), false);
  });
});

describe('assertBlockNotInPast', () => {
  it('allows a block starting now or later', () => {
    assertBlockNotInPast(at(10), at(10));
    assertBlockNotInPast(at(11), at(10));
  });

  it('rejects a block starting in the past', () => {
    assert.throws(() => assertBlockNotInPast(at(9), at(10)), BlockInPastError);
  });
});
