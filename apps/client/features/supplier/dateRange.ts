import { MAX_CALENDAR_DAYS, todayInRentalZone } from '@ee/contracts';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Asia/Kolkata is UTC+05:30 all year (no daylight saving). */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const DEFAULT_CALENDAR_DAYS = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real `YYYY-MM-DD` date. */
export function isCalendarDate(text: string): boolean {
  if (!DATE_RE.test(text)) return false;
  const ms = Date.parse(`${text}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === text;
}

/** Midnight at the start of `date` in Asia/Kolkata, as epoch milliseconds. */
export function istMidnightMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS;
}

/** Midnight at the start of `date` in Asia/Kolkata, as an ISO instant. */
export function istMidnight(date: string): string {
  return new Date(istMidnightMs(date)).toISOString();
}

/** The Asia/Kolkata calendar date an instant falls on. */
export function istDate(instant: string | number): string {
  const ms = typeof instant === 'number' ? instant : Date.parse(instant);
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** A run of whole Asia/Kolkata days starting at `startDate`. */
export interface DayRange {
  startDate: string;
  days: number;
}

export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_CALENDAR_DAYS;
  return Math.min(MAX_CALENDAR_DAYS, Math.max(1, Math.trunc(days)));
}

export function defaultRange(now: Date = new Date()): DayRange {
  return { startDate: todayInRentalZone(now), days: DEFAULT_CALENDAR_DAYS };
}

/** The half-open `[from, to)` query for a day range, at most `MAX_CALENDAR_DAYS` long. */
export function rangeToQuery(range: DayRange): { from: string; to: string } {
  const days = clampDays(range.days);
  return { from: istMidnight(range.startDate), to: istMidnight(addDays(range.startDate, days)) };
}

/**
 * The instants for blocking whole days `startDate`..`endDate` (both included):
 * `[startDate 00:00 IST, endDate + 1 00:00 IST)`, the same convention bookings use.
 */
export function daysToInstants(startDate: string, endDate: string) {
  return { startAt: istMidnight(startDate), endAt: istMidnight(addDays(endDate, 1)) };
}

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "7 Oct 2026", without relying on Intl locale data (missing on some Android builds). */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(startDate)} – ${formatDate(endDate)}`;
}
