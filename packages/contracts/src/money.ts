import { z } from 'zod';

/** Largest daily or hourly rate, in rupees. */
export const MAX_RATE_RUPEES = 1_000_000;

/**
 * Rounds a rupee amount to paise, half away from zero, without binary float errors:
 * `roundRupees(1.005) === 1.01` and `roundRupees(0.1 + 0.2) === 0.3`.
 */
export function roundRupees(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`Not a finite amount: ${value}`);
  const magnitude = Math.abs(value);
  if (magnitude < 1e-6) return 0;
  // 15 significant digits drop the float noise (1.005 is stored as 1.00499999…) and, for
  // amounts this size, never use exponent notation, so the decimal shift below is exact.
  const clean = Number(magnitude.toPrecision(15));
  const rounded = Number(`${Math.round(Number(`${clean}e2`))}e-2`);
  return value < 0 ? -rounded : rounded;
}

const hasAtMostTwoDecimals = (value: number) => roundRupees(value) === value;
const twoDecimals = { message: 'Amount must have at most two decimal places' };

/** An amount that may be negative (adjustments, refunds). */
export const signedRupeesSchema = z.number().finite().refine(hasAtMostTwoDecimals, twoDecimals);

/** A non-negative amount in rupees with at most two decimals. */
export const rupeesSchema = signedRupeesSchema.refine((value) => value >= 0, {
  message: 'Amount must not be negative',
});

/** A price rate: rupees up to {@link MAX_RATE_RUPEES}. */
export const rateSchema = rupeesSchema.refine((value) => value <= MAX_RATE_RUPEES, {
  message: `Rate must be at most ${MAX_RATE_RUPEES}`,
});
