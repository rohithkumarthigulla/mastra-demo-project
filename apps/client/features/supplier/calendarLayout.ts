import type { BlockReason, CalendarSlotDto, FleetCalendarDto, SlotState } from '@ee/contracts';
import {
  addDays,
  clampDays,
  DAY_MS,
  istDate,
  istMidnightMs,
  MONTHS,
  type DayRange,
} from './dateRange';

export interface CalendarDay {
  date: string;
  /** Day of the month, e.g. "7". */
  label: string;
  /** Short month, shown on the first day and on the 1st of each month. */
  month: string | null;
}

export function calendarDays(range: DayRange): CalendarDay[] {
  const days = clampDays(range.days);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(range.startDate, index);
    const day = Number(date.slice(8, 10));
    return {
      date,
      label: String(day),
      month: index === 0 || day === 1 ? MONTHS[Number(date.slice(5, 7)) - 1]! : null,
    };
  });
}

/** A slot placed on the day grid. */
export interface SlotSegment {
  state: SlotState;
  sourceId: string;
  reason: BlockReason | null;
  note: string | null;
  /** First day column covered (0-based). */
  startCol: number;
  /** Number of day columns covered (≥ 1). */
  span: number;
  /** The slot starts before / ends after the visible range. */
  clippedStart: boolean;
  clippedEnd: boolean;
  /** First and last Asia/Kolkata day the slot touches. */
  firstDate: string;
  lastDate: string;
}

/**
 * Places slots on a grid of whole Asia/Kolkata days. A slot covers every day it touches,
 * so a block from 10:00 to 14:00 fills that one day. Slots are clipped to the range, and
 * slots outside it are dropped.
 */
export function layoutLane(range: DayRange, slots: CalendarSlotDto[]): SlotSegment[] {
  const days = clampDays(range.days);
  const fromMs = istMidnightMs(range.startDate);
  const toMs = fromMs + days * DAY_MS;

  const segments: SlotSegment[] = [];
  for (const slot of slots) {
    const startMs = Date.parse(slot.startAt);
    const endMs = Date.parse(slot.endAt);
    if (endMs <= fromMs || startMs >= toMs || endMs <= startMs) continue;

    const startCol = Math.floor((Math.max(startMs, fromMs) - fromMs) / DAY_MS);
    const endCol = Math.ceil((Math.min(endMs, toMs) - fromMs) / DAY_MS);
    segments.push({
      state: slot.state,
      sourceId: slot.source.id,
      reason: slot.state === 'BLOCKED' ? slot.reason : null,
      note: slot.state === 'BLOCKED' ? slot.note : null,
      startCol,
      span: endCol - startCol,
      clippedStart: startMs < fromMs,
      clippedEnd: endMs > toMs,
      firstDate: istDate(startMs),
      // endAt is exclusive, so the last day touched is the one just before it.
      lastDate: istDate(endMs - 1),
    });
  }
  return segments.sort((a, b) => a.startCol - b.startCol);
}

/** Whether any slot overlaps the half-open range `[fromMs, toMs)`. */
export function overlapsAny(slots: CalendarSlotDto[], fromMs: number, toMs: number): boolean {
  return slots.some((slot) => Date.parse(slot.startAt) < toMs && Date.parse(slot.endAt) > fromMs);
}

/**
 * Unit ids free for every day from `startDate` to `endDate` (both included), according to
 * a fleet calendar that covers those days. The server still checks when the quote is sent.
 */
export function freeUnitIds(
  calendar: FleetCalendarDto,
  startDate: string,
  endDate: string,
): Set<string> {
  const fromMs = istMidnightMs(startDate);
  const toMs = istMidnightMs(addDays(endDate, 1));
  return new Set(
    calendar.lanes.filter((lane) => !overlapsAny(lane.slots, fromMs, toMs)).map((l) => l.unitId),
  );
}
