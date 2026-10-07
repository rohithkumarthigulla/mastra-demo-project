import { describe, expect, it } from 'vitest';
import { emptyBlockForm, validateBlock } from './blockForm';

const UNIT = '22222222-2222-4222-8222-222222222222';
// 23:00 UTC on 6 Oct is already 7 Oct in India.
const NOW = new Date('2026-10-06T23:00:00.000Z');

describe('validateBlock', () => {
  it('starts on today in India', () => {
    expect(emptyBlockForm(UNIT, NOW)).toMatchObject({
      startDate: '2026-10-07',
      endDate: '2026-10-07',
    });
  });

  it('blocks whole IST days, end day included', () => {
    const result = validateBlock(
      {
        unitId: UNIT,
        reason: 'MAINTENANCE',
        startDate: '2026-10-09',
        endDate: '2026-10-15',
        note: ' Service ',
      },
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      unitId: UNIT,
      value: {
        reason: 'MAINTENANCE',
        startAt: '2026-10-08T18:30:00.000Z',
        endAt: '2026-10-15T18:30:00.000Z',
        note: 'Service',
      },
    });
  });

  it('allows a single-day block and drops a blank note', () => {
    const result = validateBlock({ ...emptyBlockForm(UNIT, NOW), reason: 'HELD_BACK' }, NOW);
    expect(result.ok && result.value).toEqual({
      reason: 'HELD_BACK',
      startAt: '2026-10-06T18:30:00.000Z',
      endAt: '2026-10-07T18:30:00.000Z',
    });
  });

  it('explains every problem at once', () => {
    const result = validateBlock(
      {
        unitId: '',
        reason: 'TRANSPORT',
        startDate: '2026-10-01',
        endDate: 'soon',
        note: 'x'.repeat(501),
      },
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        unitId: 'Choose a machine.',
        startDate: 'Blocks must start today or later.',
        endDate: 'Enter a date as YYYY-MM-DD.',
        note: 'Keep the note to 500 characters.',
      },
    });
  });

  it('rejects an end before the start', () => {
    const result = validateBlock(
      { ...emptyBlockForm(UNIT, NOW), startDate: '2026-10-10', endDate: '2026-10-09' },
      NOW,
    );
    expect(result.ok ? null : result.errors).toEqual({
      endDate: 'End on or after the start date.',
    });
  });
});
