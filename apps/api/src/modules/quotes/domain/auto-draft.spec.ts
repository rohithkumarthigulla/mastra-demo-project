import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { autoDraftLines } from './auto-draft';

const NO_CARD = { weekRate: null, monthRate: null, transportFee: null, depositAmount: null };

describe('auto-drafted quote lines', () => {
  it('uses the day rate for short rentals and adds transport and deposit', () => {
    const lines = autoDraftLines(3, 10000, {
      weekRate: 60000,
      monthRate: null,
      transportFee: 4500,
      depositAmount: 20000,
    });
    assert.deepEqual(
      lines.map((l) => [l.type, l.quantity, l.unitAmount]),
      [
        ['RENTAL', 3, 10000],
        ['TRANSPORT', 1, 4500],
        ['DEPOSIT', 1, 20000],
      ],
    );
  });

  it('uses the cheapest rate the rental length qualifies for', () => {
    const card = { ...NO_CARD, weekRate: 63000, monthRate: 240000 };
    assert.equal(autoDraftLines(7, 10000, card)[0]!.unitAmount, 9000);
    assert.equal(autoDraftLines(30, 10000, card)[0]!.unitAmount, 8000);
    // A week rate above 7 × day rate is never chosen.
    assert.equal(autoDraftLines(10, 10000, { ...NO_CARD, weekRate: 80000 })[0]!.unitAmount, 10000);
  });

  it('rounds the per-day rate to the paisa and skips empty extras', () => {
    const lines = autoDraftLines(7, 10000, { ...NO_CARD, weekRate: 50000, transportFee: 0 });
    assert.deepEqual(
      lines.map((l) => [l.type, l.unitAmount]),
      [['RENTAL', 7142.86]],
    );
  });
});
