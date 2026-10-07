import { describe, expect, it } from 'vitest';
import {
  createUnitRequestSchema,
  createYardRequestSchema,
  updateUnitRequestSchema,
  updateYardRequestSchema,
} from './fleet.js';

const unit = {
  listingId: '00000000-0000-4000-8000-000000000001',
  yardId: '00000000-0000-4000-8000-000000000002',
  modelYear: 2020,
  condition: 'GOOD',
};

describe('createYardRequestSchema', () => {
  const yard = { name: 'Main yard', cityGeoId: 'IN-TG-HYD', address: 'Plot 4, Patancheru' };

  it('trims and accepts names of 1 to 80 characters', () => {
    expect(createYardRequestSchema.parse({ ...yard, name: '  A  ' }).name).toBe('A');
    expect(createYardRequestSchema.safeParse({ ...yard, name: 'x'.repeat(80) }).success).toBe(true);
    expect(createYardRequestSchema.safeParse({ ...yard, name: ' ' }).success).toBe(false);
    expect(createYardRequestSchema.safeParse({ ...yard, name: 'x'.repeat(81) }).success).toBe(
      false,
    );
  });

  it('caps the address at 300 characters', () => {
    expect(createYardRequestSchema.safeParse({ ...yard, address: 'x'.repeat(300) }).success).toBe(
      true,
    );
    expect(createYardRequestSchema.safeParse({ ...yard, address: 'x'.repeat(301) }).success).toBe(
      false,
    );
  });

  it('rejects unknown keys and empty updates', () => {
    expect(createYardRequestSchema.safeParse({ ...yard, extra: 1 }).success).toBe(false);
    expect(updateYardRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('createUnitRequestSchema', () => {
  it('accepts model years 1950 to 2100 only', () => {
    for (const modelYear of [1950, 2100]) {
      expect(createUnitRequestSchema.safeParse({ ...unit, modelYear }).success).toBe(true);
    }
    for (const modelYear of [1949, 2101, 2020.5]) {
      expect(createUnitRequestSchema.safeParse({ ...unit, modelYear }).success).toBe(false);
    }
  });

  it('defaults identifiers to none and rejects a repeated type', () => {
    expect(createUnitRequestSchema.parse(unit).identifiers).toEqual([]);
    const identifiers = [
      { type: 'SERIAL_NUMBER', value: 'A1' },
      { type: 'SERIAL_NUMBER', value: 'B2' },
    ];
    expect(createUnitRequestSchema.safeParse({ ...unit, identifiers }).success).toBe(false);
  });

  it('caps label and identifier values at 80 characters', () => {
    expect(createUnitRequestSchema.safeParse({ ...unit, label: 'x'.repeat(81) }).success).toBe(
      false,
    );
    const identifiers = [{ type: 'ENGINE_NUMBER', value: 'x'.repeat(81) }];
    expect(createUnitRequestSchema.safeParse({ ...unit, identifiers }).success).toBe(false);
  });
});

describe('updateUnitRequestSchema', () => {
  it('allows clearing the label and rejects empty or listing changes', () => {
    expect(updateUnitRequestSchema.safeParse({ label: null }).success).toBe(true);
    expect(updateUnitRequestSchema.safeParse({}).success).toBe(false);
    expect(updateUnitRequestSchema.safeParse({ listingId: unit.listingId }).success).toBe(false);
  });
});
