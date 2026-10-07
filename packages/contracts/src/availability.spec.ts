import { describe, expect, it } from 'vitest';
import { calendarRangeQuerySchema, createBlockRequestSchema } from './availability.js';

describe('createBlockRequestSchema', () => {
  const block = {
    reason: 'MAINTENANCE',
    startAt: '2026-03-01T10:00:00Z',
    endAt: '2026-03-02T10:00:00Z',
  };

  it('accepts a valid block with an optional note', () => {
    expect(createBlockRequestSchema.safeParse(block).success).toBe(true);
    expect(createBlockRequestSchema.safeParse({ ...block, note: 'Hydraulics' }).success).toBe(true);
  });

  it('rejects an end at or before the start', () => {
    expect(createBlockRequestSchema.safeParse({ ...block, endAt: block.startAt }).success).toBe(
      false,
    );
  });

  it('caps the note at 500 characters', () => {
    expect(createBlockRequestSchema.safeParse({ ...block, note: 'x'.repeat(500) }).success).toBe(
      true,
    );
    expect(createBlockRequestSchema.safeParse({ ...block, note: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });

  it('accepts offsets and rejects unknown reasons', () => {
    expect(
      createBlockRequestSchema.safeParse({ ...block, startAt: '2026-03-01T15:30:00+05:30' })
        .success,
    ).toBe(true);
    expect(createBlockRequestSchema.safeParse({ ...block, reason: 'HOLIDAY' }).success).toBe(false);
  });
});

describe('calendarRangeQuerySchema', () => {
  it('requires both ends and to after from', () => {
    expect(calendarRangeQuerySchema.safeParse({ from: '2026-03-01T00:00:00Z' }).success).toBe(
      false,
    );
    expect(
      calendarRangeQuerySchema.safeParse({
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-01T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('allows at most 92 days', () => {
    const from = '2026-01-01T00:00:00Z';
    const at = (days: number) => new Date(Date.parse(from) + days * 86_400_000).toISOString();
    expect(calendarRangeQuerySchema.safeParse({ from, to: at(92) }).success).toBe(true);
    expect(calendarRangeQuerySchema.safeParse({ from, to: at(93) }).success).toBe(false);
  });
});
