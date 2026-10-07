import { describe, expect, it } from 'vitest';
import { formatDailyRate, formatRupees } from './format';

describe('formatRupees', () => {
  it.each([
    [12500, '₹12,500.00'],
    [100000, '₹1,00,000.00'],
    [1234567.5, '₹12,34,567.50'],
    [999, '₹999.00'],
    [0.5, '₹0.50'],
    [1000000, '₹10,00,000.00'],
    [-2500, '-₹2,500.00'],
  ])('formats %s as %s', (amount, expected) => {
    expect(formatRupees(amount)).toBe(expected);
  });

  it('rounds to paise', () => {
    expect(formatRupees(10.005)).toMatch(/^₹10\.0[01]$/);
    expect(formatRupees(0.1 + 0.2)).toBe('₹0.30');
  });

  it('adds the per-day suffix', () => {
    expect(formatDailyRate(12500)).toBe('₹12,500.00 / day');
  });
});
