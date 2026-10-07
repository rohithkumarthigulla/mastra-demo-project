import { todayInRentalZone, type CalendarDate } from '@ee/contracts';

/** A calendar date `days` from today in the rental time zone. */
export function dateFromToday(days: number): CalendarDate {
  const today = Date.parse(`${todayInRentalZone()}T00:00:00Z`);
  return new Date(today + days * 86_400_000).toISOString().slice(0, 10);
}
