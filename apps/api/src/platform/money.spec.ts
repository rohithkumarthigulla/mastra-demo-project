import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addRupees, multiplyRupees, readNumeric, toNumericString } from './money';

describe('money helpers', () => {
  it('reads numeric columns as rupees', () => {
    assert.equal(readNumeric('12.50'), 12.5);
    assert.equal(readNumeric('0.00'), 0);
    assert.equal(readNumeric('-3.25'), -3.25);
    assert.equal(readNumeric('999999999999.99'), 999999999999.99);
    assert.equal(readNumeric(null), null);
    assert.throws(() => readNumeric('abc'), RangeError);
    assert.throws(() => readNumeric(''), RangeError);
  });

  it('writes amounts with exactly two decimals', () => {
    assert.equal(toNumericString(12.5), '12.50');
    assert.equal(toNumericString(1.005), '1.01');
    assert.equal(toNumericString(0.1 + 0.2), '0.30');
  });

  it('adds and multiplies, rounding after every step', () => {
    assert.equal(addRupees(0.1, 0.2), 0.3);
    assert.equal(addRupees(), 0);
    assert.equal(addRupees(1.005, 1.005), 2.02);
    assert.equal(multiplyRupees(19.99, 3), 59.97);
    assert.equal(multiplyRupees(100, 0.18), 18);
    assert.equal(multiplyRupees(333.33, 1 / 3), 111.11);
  });
});
