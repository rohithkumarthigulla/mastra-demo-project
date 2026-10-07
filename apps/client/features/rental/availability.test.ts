import { describe, expect, it } from 'vitest';
import { availabilityRange } from './availability';

describe('availabilityRange', () => {
  it('spans whole India days, end-exclusive', () => {
    expect(availabilityRange('2026-10-08', '2026-10-10')).toEqual({
      from: '2026-10-07T18:30:00.000Z',
      to: '2026-10-10T18:30:00.000Z',
    });
  });

  it('covers one full day for a same-day rental', () => {
    expect(availabilityRange('2026-10-08', '2026-10-08')).toEqual({
      from: '2026-10-07T18:30:00.000Z',
      to: '2026-10-08T18:30:00.000Z',
    });
  });
});
