import { QUOTE_TAX_PERCENT, roundRupees, type QuoteLineInput } from '@ee/contracts';
import { addRupees } from '../../../platform/money';
import { NegativeSubtotalError } from './errors';

/** A line with its server-computed amount; `amount` is negative for `DISCOUNT`. */
export interface PricedLine extends QuoteLineInput {
  amount: number;
  position: number;
}

export interface QuoteTotals {
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  depositAmount: number;
  total: number;
}

export function priceLines(lines: readonly QuoteLineInput[]): PricedLine[] {
  return lines.map((line, position) => {
    const gross = roundRupees(line.quantity * line.unitAmount);
    return { ...line, amount: line.type === 'DISCOUNT' ? -gross : gross, position };
  });
}

/**
 * subtotal = every line except DEPOSIT (DISCOUNT counts negative); tax = 18% of subtotal;
 * deposit is never taxed; total = subtotal + tax + deposit. Rounded after every step.
 */
export function quoteTotals(lines: readonly PricedLine[]): QuoteTotals {
  const subtotal = addRupees(...lines.filter((l) => l.type !== 'DEPOSIT').map((l) => l.amount));
  if (subtotal < 0) throw new NegativeSubtotalError();
  const depositAmount = addRupees(
    ...lines.filter((l) => l.type === 'DEPOSIT').map((l) => l.amount),
  );
  const taxAmount = roundRupees((subtotal * QUOTE_TAX_PERCENT) / 100);
  return {
    subtotal,
    taxPercent: QUOTE_TAX_PERCENT,
    taxAmount,
    depositAmount,
    total: addRupees(subtotal, taxAmount, depositAmount),
  };
}
