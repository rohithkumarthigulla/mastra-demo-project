import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '../../../platform/http';
import { convert, dimensionOf } from './units';

describe('units', () => {
  it('converts within a dimension', () => {
    assert.equal(convert(6720, 'mm', 'm'), 6.72);
    assert.equal(convert(6.72, 'm', 'mm'), 6720);
    assert.equal(convert(2, 't', 'kg'), 2000);
    assert.equal(convert(21500, 'kg', 't'), 21.5);
    assert.equal(convert(100, 'hp', 'kW'), 74.57);
    assert.equal(convert(74.57, 'kW', 'hp'), 100);
    assert.equal(convert(1.2, 'm3', 'm3'), 1.2);
    assert.equal(convert(0, 'mm', 'm'), 0);
  });

  it('removes floating point noise', () => {
    // Plain arithmetic gives 0.30000000000000004 for 0.1 + 0.2 style inputs.
    assert.equal(convert(300, 'mm', 'm'), 0.3);
    assert.equal(convert(0.7, 't', 'kg'), 700);
  });

  it('rejects conversions across dimensions', () => {
    for (const [from, to] of [
      ['kg', 'm'],
      ['mm', 'kW'],
      ['hp', 'm3'],
      ['m3', 't'],
    ] as const) {
      assert.throws(
        () => convert(1, from, to),
        (e: unknown) =>
          e instanceof DomainError && e.code === 'incompatible_unit' && e.status === 400,
      );
    }
  });

  it('reports dimensions', () => {
    assert.equal(dimensionOf('t'), 'mass');
    assert.equal(dimensionOf('mm'), 'length');
    assert.equal(dimensionOf('hp'), 'power');
    assert.equal(dimensionOf('m3'), 'volume');
  });
});
