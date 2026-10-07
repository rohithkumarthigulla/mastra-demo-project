import { roundRupees, type QuoteLineInput } from '@ee/contracts';

export interface RateCardAmounts {
  weekRate: number | null;
  monthRate: number | null;
  transportFee: number | null;
  depositAmount: number | null;
}

/**
 * Lines for a quote drafted automatically from the listing's day rate and rate card.
 * The rental line uses the cheapest per-day price the rental length qualifies for
 * (week rate from 7 days, month rate from 30 days). Operator is never assumed.
 */
export function autoDraftLines(
  days: number,
  pricePerDay: number,
  card: RateCardAmounts,
): QuoteLineInput[] {
  const dailyRates = [pricePerDay];
  if (card.weekRate !== null && days >= 7) dailyRates.push(card.weekRate / 7);
  if (card.monthRate !== null && days >= 30) dailyRates.push(card.monthRate / 30);
  const lines: QuoteLineInput[] = [
    {
      type: 'RENTAL',
      description: `Rental, ${days} day${days === 1 ? '' : 's'}`,
      quantity: days,
      unitAmount: roundRupees(Math.min(...dailyRates)),
    },
  ];
  if (card.transportFee) {
    lines.push({
      type: 'TRANSPORT',
      description: 'Transport',
      quantity: 1,
      unitAmount: card.transportFee,
    });
  }
  if (card.depositAmount) {
    lines.push({
      type: 'DEPOSIT',
      description: 'Security deposit',
      quantity: 1,
      unitAmount: card.depositAmount,
    });
  }
  return lines;
}
