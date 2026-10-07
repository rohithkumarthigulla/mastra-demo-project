import { RENTAL_TIME_ZONE } from '@ee/contracts';

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: RENTAL_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

// Calendar dates carry no zone; format them at UTC so the day never shifts.
const DAY = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** An instant, shown in the rental zone: "7 Oct, 2:30 pm". */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** A calendar date (YYYY-MM-DD): "7 Oct 2026". */
export function formatDate(date: string): string {
  return DAY.format(new Date(`${date}T00:00:00Z`));
}

/** "7 Oct 2026 – 9 Oct 2026 · 3 days" */
export function formatDateRange(startDate: string, endDate: string, days: number): string {
  const span =
    startDate === endDate
      ? formatDate(startDate)
      : `${formatDate(startDate)} – ${formatDate(endDate)}`;
  return `${span} · ${days} ${days === 1 ? 'day' : 'days'}`;
}
