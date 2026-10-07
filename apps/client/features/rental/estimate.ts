import {
  calendarDateSchema,
  MAX_RENTAL_DAYS,
  QUOTE_TAX_PERCENT,
  rentalDays,
  roundRupees,
  todayInRentalZone,
} from '@ee/contracts';

export interface RentalDateErrors {
  startDate?: string;
  endDate?: string;
}

const isDate = (value: string) => calendarDateSchema.safeParse(value).success;

/** Same rules as the api's `withRentalDateRules`, worded for the form. */
export function validateRentalDates(
  startDate: string,
  endDate: string,
  today: string = todayInRentalZone(),
): RentalDateErrors {
  const errors: RentalDateErrors = {};
  if (!isDate(startDate)) errors.startDate = 'Enter a date as YYYY-MM-DD.';
  else if (startDate < today) errors.startDate = 'Start date can’t be in the past.';
  if (!isDate(endDate)) errors.endDate = 'Enter a date as YYYY-MM-DD.';
  else if (isDate(startDate) && endDate < startDate) {
    errors.endDate = 'End date can’t be before the start date.';
  } else if (isDate(startDate) && rentalDays(startDate, endDate) > MAX_RENTAL_DAYS) {
    errors.endDate = `A rental is at most ${MAX_RENTAL_DAYS} days.`;
  }
  return errors;
}

export interface RentalEstimate {
  days: number;
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Rough price at the listed daily rate, taxed like a quote. The supplier's quote may add
 * transport, operator, deposit or discounts.
 */
export function estimateRental(
  pricePerDay: number,
  startDate: string,
  endDate: string,
): RentalEstimate | null {
  if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) return null;
  const days = rentalDays(startDate, endDate);
  const subtotal = roundRupees(pricePerDay * days);
  const tax = roundRupees((subtotal * QUOTE_TAX_PERCENT) / 100);
  return { days, subtotal, tax, total: roundRupees(subtotal + tax) };
}
