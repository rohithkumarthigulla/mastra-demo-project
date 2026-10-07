import { describe, expect, it } from 'vitest';
import { estimateRental, validateRentalDates } from './estimate';

const TODAY = '2026-10-07';

describe('validateRentalDates', () => {
  it('accepts a same-day rental starting today', () => {
    expect(validateRentalDates(TODAY, TODAY, TODAY)).toEqual({});
  });

  it('rejects malformed dates', () => {
    expect(validateRentalDates('7/10/2026', '2026-02-30', TODAY)).toEqual({
      startDate: 'Enter a date as YYYY-MM-DD.',
      endDate: 'Enter a date as YYYY-MM-DD.',
    });
  });

  it('rejects a start in the past', () => {
    expect(validateRentalDates('2026-10-06', '2026-10-08', TODAY).startDate).toMatch(/past/);
  });

  it('rejects an end before the start', () => {
    expect(validateRentalDates('2026-10-10', '2026-10-09', TODAY).endDate).toMatch(/before/);
  });

  it('allows 365 days and rejects 366', () => {
    expect(validateRentalDates('2026-10-07', '2027-10-06', TODAY)).toEqual({});
    expect(validateRentalDates('2026-10-07', '2027-10-07', TODAY).endDate).toMatch(/365/);
  });
});

describe('estimateRental', () => {
  it('counts both the start and end day', () => {
    expect(estimateRental(1000, '2026-10-07', '2026-10-07')).toEqual({
      days: 1,
      subtotal: 1000,
      tax: 180,
      total: 1180,
    });
    expect(estimateRental(1000, '2026-10-07', '2026-10-09')?.days).toBe(3);
  });

  it('rounds tax to paise', () => {
    expect(estimateRental(333.33, '2026-10-07', '2026-10-07')).toEqual({
      days: 1,
      subtotal: 333.33,
      tax: 60,
      total: 393.33,
    });
  });

  it('returns null until both dates are valid and ordered', () => {
    expect(estimateRental(1000, '', '2026-10-07')).toBeNull();
    expect(estimateRental(1000, '2026-10-09', '2026-10-07')).toBeNull();
  });
});
