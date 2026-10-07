import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NegativeSubtotalError } from './errors';
import { priceLines, quoteTotals } from './totals';

describe('quote totals', () => {
  it('taxes everything but the deposit and subtracts discounts', () => {
    const lines = priceLines([
      { type: 'RENTAL', description: 'Rental', quantity: 5, unitAmount: 12000 },
      { type: 'TRANSPORT', description: 'Transport', quantity: 1, unitAmount: 4500 },
      { type: 'DISCOUNT', description: 'Repeat customer', quantity: 1, unitAmount: 2500 },
      { type: 'DEPOSIT', description: 'Deposit', quantity: 1, unitAmount: 20000 },
    ]);
    assert.deepEqual(
      lines.map((l) => [l.amount, l.position]),
      [
        [60000, 0],
        [4500, 1],
        [-2500, 2],
        [20000, 3],
      ],
    );
    assert.deepEqual(quoteTotals(lines), {
      subtotal: 62000,
      taxPercent: 18,
      taxAmount: 11160,
      depositAmount: 20000,
      total: 93160,
    });
  });

  it('rounds tax to the paisa, half away from zero', () => {
    const lines = priceLines([
      { type: 'RENTAL', description: 'Rental', quantity: 3, unitAmount: 33.33 },
      { type: 'OPERATOR', description: 'Operator', quantity: 1, unitAmount: 0.03 },
    ]);
    // subtotal 100.02 → tax 18.0036 → 18.00
    assert.deepEqual(quoteTotals(lines), {
      subtotal: 100.02,
      taxPercent: 18,
      taxAmount: 18,
      depositAmount: 0,
      total: 118.02,
    });
    const half = priceLines([{ type: 'RENTAL', description: 'R', quantity: 1, unitAmount: 0.25 }]);
    // 0.25 × 18% = 0.045 → 0.05
    assert.equal(quoteTotals(half).taxAmount, 0.05);
  });

  it('rejects discounts larger than the taxable lines', () => {
    const lines = priceLines([
      { type: 'RENTAL', description: 'Rental', quantity: 1, unitAmount: 100 },
      { type: 'DISCOUNT', description: 'Too much', quantity: 1, unitAmount: 150 },
      { type: 'DEPOSIT', description: 'Deposit', quantity: 1, unitAmount: 500 },
    ]);
    assert.throws(() => quoteTotals(lines), NegativeSubtotalError);
  });
});
