import { QUOTE_TAX_PERCENT, roundRupees, type QuoteLineInput } from '@ee/contracts';

export interface QuoteTotals {
  subtotal: number;
  taxAmount: number;
  depositAmount: number;
  total: number;
}

/** quantity × unitAmount in rupees, negative for a `DISCOUNT` line. */
export function lineAmount(line: Pick<QuoteLineInput, 'type' | 'quantity' | 'unitAmount'>) {
  const amount = roundRupees(line.quantity * line.unitAmount);
  return line.type === 'DISCOUNT' ? -amount : amount;
}

/**
 * The totals the server will calculate (docs/contracts.md, "Totals"), for a live preview
 * while editing. After saving, always show the server's figures instead.
 */
export function previewTotals(
  lines: Pick<QuoteLineInput, 'type' | 'quantity' | 'unitAmount'>[],
): QuoteTotals {
  let subtotal = 0;
  let depositAmount = 0;
  for (const line of lines) {
    const amount = lineAmount(line);
    if (line.type === 'DEPOSIT') depositAmount = roundRupees(depositAmount + amount);
    else subtotal = roundRupees(subtotal + amount);
  }
  const taxAmount = roundRupees((subtotal * QUOTE_TAX_PERCENT) / 100);
  return {
    subtotal,
    taxAmount,
    depositAmount,
    total: roundRupees(subtotal + taxAmount + depositAmount),
  };
}
