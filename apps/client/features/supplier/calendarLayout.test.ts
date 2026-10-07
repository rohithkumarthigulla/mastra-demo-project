import type { CalendarSlotDto } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import { calendarDays, freeUnitIds, layoutLane } from './calendarLayout';
import {
  daysToInstants,
  defaultRange,
  formatDate,
  formatDateRange,
  isCalendarDate,
  istDate,
  rangeToQuery,
} from './dateRange';
import { fleetCalendarFixture } from './fixtures';

const BLOCK_ID = '44444444-4444-4444-8444-444444444444';
const BOOKING_ID = '66666666-6666-4666-8666-666666666666';

function block(startAt: string, endAt: string): CalendarSlotDto {
  return {
    state: 'BLOCKED',
    startAt,
    endAt,
    source: { type: 'BLOCK', id: BLOCK_ID },
    reason: 'MAINTENANCE',
    note: null,
  };
}

function booked(startAt: string, endAt: string): CalendarSlotDto {
  return { state: 'BOOKED', startAt, endAt, source: { type: 'BOOKING', id: BOOKING_ID } };
}

// 7 days from 10 Oct 2026, i.e. [9 Oct 18:30Z, 16 Oct 18:30Z).
const RANGE = { startDate: '2026-10-10', days: 7 };

describe('dateRange', () => {
  it('uses Asia/Kolkata midnights for the query', () => {
    expect(rangeToQuery(RANGE)).toEqual({
      from: '2026-10-09T18:30:00.000Z',
      to: '2026-10-16T18:30:00.000Z',
    });
  });

  it('clamps the range to the contract maximum', () => {
    const { from, to } = rangeToQuery({ startDate: '2026-10-10', days: 500 });
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBe(92);
    expect(rangeToQuery({ startDate: '2026-10-10', days: 0 }).to).toBe('2026-10-10T18:30:00.000Z');
  });

  it('defaults to the next 30 days from today in India', () => {
    // 20:00 UTC on 7 Oct is already 8 Oct in India.
    expect(defaultRange(new Date('2026-10-07T20:00:00Z'))).toEqual({
      startDate: '2026-10-08',
      days: 30,
    });
  });

  it('blocks whole days, end date included', () => {
    expect(daysToInstants('2026-10-10', '2026-10-16')).toEqual({
      startAt: '2026-10-09T18:30:00.000Z',
      endAt: '2026-10-16T18:30:00.000Z',
    });
  });

  it('reads the Indian date of an instant', () => {
    expect(istDate('2026-10-09T18:29:59.999Z')).toBe('2026-10-09');
    expect(istDate('2026-10-09T18:30:00.000Z')).toBe('2026-10-10');
  });

  it('validates and formats dates', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-2-3')).toBe(false);
    expect(formatDate('2026-10-07')).toBe('7 Oct 2026');
    expect(formatDateRange('2026-10-07', '2026-10-07')).toBe('7 Oct 2026');
    expect(formatDateRange('2026-10-07', '2026-10-09')).toBe('7 Oct 2026 – 9 Oct 2026');
  });
});

describe('calendarDays', () => {
  it('lists each day and marks month starts', () => {
    const days = calendarDays({ startDate: '2026-10-30', days: 4 });
    expect(days).toEqual([
      { date: '2026-10-30', label: '30', month: 'Oct' },
      { date: '2026-10-31', label: '31', month: null },
      { date: '2026-11-01', label: '1', month: 'Nov' },
      { date: '2026-11-02', label: '2', month: null },
    ]);
  });
});

describe('layoutLane', () => {
  it('places a multi-day slot on whole days', () => {
    // 12 Oct to 14 Oct inclusive.
    const [segment] = layoutLane(RANGE, [
      block('2026-10-11T18:30:00.000Z', '2026-10-14T18:30:00.000Z'),
    ]);
    expect(segment).toEqual({
      state: 'BLOCKED',
      sourceId: BLOCK_ID,
      reason: 'MAINTENANCE',
      note: null,
      startCol: 2,
      span: 3,
      clippedStart: false,
      clippedEnd: false,
      firstDate: '2026-10-12',
      lastDate: '2026-10-14',
    });
  });

  it('fills every day a part-day slot touches', () => {
    // 10:00 to 14:00 IST on 11 Oct, and 22:00 on 11 Oct to 02:00 on 12 Oct.
    const segments = layoutLane(RANGE, [
      block('2026-10-11T04:30:00.000Z', '2026-10-11T08:30:00.000Z'),
      booked('2026-10-11T16:30:00.000Z', '2026-10-11T20:30:00.000Z'),
    ]);
    expect(segments.map((s) => [s.startCol, s.span, s.firstDate, s.lastDate])).toEqual([
      [1, 1, '2026-10-11', '2026-10-11'],
      [1, 2, '2026-10-11', '2026-10-12'],
    ]);
  });

  it('clips slots at both edges', () => {
    const segments = layoutLane(RANGE, [
      booked('2026-10-01T18:30:00.000Z', '2026-10-11T18:30:00.000Z'),
      block('2026-10-15T18:30:00.000Z', '2026-10-30T18:30:00.000Z'),
    ]);
    expect(segments).toEqual([
      expect.objectContaining({ startCol: 0, span: 2, clippedStart: true, clippedEnd: false }),
      expect.objectContaining({ startCol: 6, span: 1, clippedStart: false, clippedEnd: true }),
    ]);
    expect(segments[0]!.reason).toBeNull();
  });

  it('covers the whole range when a slot spans it', () => {
    const [segment] = layoutLane(RANGE, [
      block('2026-09-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z'),
    ]);
    expect(segment).toMatchObject({ startCol: 0, span: 7, clippedStart: true, clippedEnd: true });
  });

  it('drops slots outside the range, including ones that touch an edge', () => {
    expect(
      layoutLane(RANGE, [
        block('2026-10-01T00:00:00.000Z', '2026-10-09T18:30:00.000Z'),
        block('2026-10-16T18:30:00.000Z', '2026-10-20T00:00:00.000Z'),
      ]),
    ).toEqual([]);
  });

  it('sorts segments by day', () => {
    const segments = layoutLane(RANGE, [
      block('2026-10-14T18:30:00.000Z', '2026-10-15T18:30:00.000Z'),
      booked('2026-10-09T18:30:00.000Z', '2026-10-10T18:30:00.000Z'),
    ]);
    expect(segments.map((s) => s.startCol)).toEqual([0, 5]);
  });
});

describe('freeUnitIds', () => {
  const calendar = fleetCalendarFixture();
  const [blockedUnit, bookedUnit] = calendar.lanes.map((lane) => lane.unitId);

  it('excludes units with any slot over the requested days', () => {
    // Unit A is blocked 10–16 Oct; unit B is booked 20–24 Oct.
    expect(freeUnitIds(calendar, '2026-10-20', '2026-10-24')).toEqual(new Set([blockedUnit]));
    expect(freeUnitIds(calendar, '2026-10-16', '2026-10-20')).toEqual(new Set());
    expect(freeUnitIds(calendar, '2026-10-17', '2026-10-19')).toEqual(
      new Set([blockedUnit, bookedUnit]),
    );
  });
});
