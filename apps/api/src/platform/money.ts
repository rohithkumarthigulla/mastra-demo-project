import { roundRupees } from '@ee/contracts';

/**
 * Rupee arithmetic for the api. Amounts are stored as `numeric(14,2)`; pg returns those
 * as strings, so read them with `readNumeric` and write them with `toNumericString`.
 * Every helper rounds to paise after each step so float error never accumulates.
 */

export function readNumeric(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (value.trim() === '' || !Number.isFinite(parsed)) {
    throw new RangeError(`Not a numeric amount: ${value}`);
  }
  return roundRupees(parsed);
}

export function toNumericString(value: number): string {
  return roundRupees(value).toFixed(2);
}

export function addRupees(...amounts: number[]): number {
  return amounts.reduce((sum, amount) => roundRupees(sum + amount), 0);
}

export function multiplyRupees(amount: number, factor: number): number {
  return roundRupees(amount * factor);
}
