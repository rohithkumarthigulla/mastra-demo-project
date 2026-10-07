import { describe, expect, it } from 'vitest';
import { formatDate, formatDateRange, formatDateTime } from './dates';

describe('dates', () => {
  it('shows calendar dates without shifting the day', () => {
    expect(formatDate('2026-10-07')).toBe('7 Oct 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('shows instants in India time', () => {
    // 18:30Z is midnight the next day in Kolkata.
    expect(formatDateTime('2026-10-06T18:30:00.000Z')).toMatch(/^7 Oct/);
  });

  it('collapses a one-day range and pluralises days', () => {
    expect(formatDateRange('2026-10-07', '2026-10-07', 1)).toBe('7 Oct 2026 · 1 day');
    expect(formatDateRange('2026-10-07', '2026-10-09', 3)).toBe('7 Oct 2026 – 9 Oct 2026 · 3 days');
  });
});
