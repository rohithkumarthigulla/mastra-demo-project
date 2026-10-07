import { describe, expect, it } from 'vitest';
import { lineAmount, previewTotals } from './quoteMath';

describe('lineAmount', () => {
  it('multiplies quantity by unit amount', () => {
    expect(lineAmount({ type: 'RENTAL', quantity: 5, unitAmount: 12500 })).toBe(62500);
  });

  it('makes a discount negative', () => {
    expect(lineAmount({ type: 'DISCOUNT', quantity: 1, unitAmount: 2500 })).toBe(-2500);
  });

  it('rounds to paise half away from zero without float error', () => {
    // 3 × 333.335 is 1000.0049999… in binary floats; the exact value rounds up.
    expect(lineAmount({ type: 'OPERATOR', quantity: 3, unitAmount: 333.335 })).toBe(1000.01);
    expect(lineAmount({ type: 'DISCOUNT', quantity: 3, unitAmount: 333.335 })).toBe(-1000.01);
  });
});

describe('previewTotals', () => {
  it('matches the server rules for a quote with every line type', () => {
    const totals = previewTotals([
      { type: 'RENTAL', quantity: 5, unitAmount: 12500 },
      { type: 'TRANSPORT', quantity: 1, unitAmount: 4000 },
      { type: 'OPERATOR', quantity: 5, unitAmount: 1500 },
      { type: 'DEPOSIT', quantity: 1, unitAmount: 25000 },
      { type: 'DISCOUNT', quantity: 1, unitAmount: 2500 },
    ]);
    // subtotal = 62500 + 4000 + 7500 − 2500; the deposit is neither in it nor taxed.
    expect(totals).toEqual({
      subtotal: 71500,
      taxAmount: 12870,
      depositAmount: 25000,
      total: 109370,
    });
  });

  it('rounds GST to paise', () => {
    // 18% of 1234.57 = 222.2226 → 222.22; 18% of 0.25 = 0.045 → 0.05 (half up).
    expect(previewTotals([{ type: 'RENTAL', quantity: 1, unitAmount: 1234.57 }])).toEqual({
      subtotal: 1234.57,
      taxAmount: 222.22,
      depositAmount: 0,
      total: 1456.79,
    });
    expect(previewTotals([{ type: 'RENTAL', quantity: 1, unitAmount: 0.25 }]).taxAmount).toBe(0.05);
  });

  it('sums decimals without float noise', () => {
    const totals = previewTotals([
      { type: 'RENTAL', quantity: 1, unitAmount: 0.1 },
      { type: 'TRANSPORT', quantity: 1, unitAmount: 0.2 },
    ]);
    expect(totals.subtotal).toBe(0.3);
    expect(totals.total).toBe(0.35);
  });

  it('lets a discount take the subtotal negative, as the server would', () => {
    const totals = previewTotals([
      { type: 'RENTAL', quantity: 1, unitAmount: 100 },
      { type: 'DISCOUNT', quantity: 1, unitAmount: 150 },
    ]);
    expect(totals).toEqual({ subtotal: -50, taxAmount: -9, depositAmount: 0, total: -59 });
  });

  it('is all zeros with no lines', () => {
    expect(previewTotals([])).toEqual({ subtotal: 0, taxAmount: 0, depositAmount: 0, total: 0 });
  });
});
