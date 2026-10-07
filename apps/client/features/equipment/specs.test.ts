import type { EquipmentSpecificationDto, SpecificationDefinitionDto } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import { describeSpec, describeSpecs, NOT_KNOWN } from './specs';

const NOW = '2026-01-01T00:00:00.000Z';

function spec(overrides: Partial<EquipmentSpecificationDto>): EquipmentSpecificationDto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    modelId: '00000000-0000-4000-8000-000000000002',
    definitionCode: 'operating_weight',
    numericValue: null,
    minValue: null,
    maxValue: null,
    unit: null,
    textValue: null,
    normalizedMin: null,
    normalizedMax: null,
    verificationStatus: 'VERIFIED',
    verifiedAt: null,
    source: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const weight: SpecificationDefinitionDto = {
  id: '00000000-0000-4000-8000-000000000003',
  code: 'operating_weight',
  displayName: 'Operating weight',
  valueType: 'NUMERIC',
  canonicalUnit: 'kg',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('describeSpec', () => {
  it('shows a verified value with its unit', () => {
    const row = describeSpec(spec({ numericValue: 8070, unit: 'kg' }));
    expect(row).toMatchObject({
      label: 'Operating weight',
      value: '8,070 kg',
      known: true,
      verified: true,
    });
  });

  it('marks unverified values', () => {
    const row = describeSpec(
      spec({ numericValue: 74, unit: 'hp', verificationStatus: 'REVIEW_REQUIRED' }),
    );
    expect(row).toMatchObject({ value: '74 hp', verified: false, known: true });
  });

  it('shows ranges and one-sided bounds', () => {
    expect(describeSpec(spec({ minValue: 1.2, maxValue: 3, unit: 'm3' })).value).toBe('1.2–3 m³');
    expect(describeSpec(spec({ maxValue: 5, unit: 'm' })).value).toBe('up to 5 m');
  });

  it('says "Not known" for UNKNOWN status even when a number is present', () => {
    const row = describeSpec(spec({ numericValue: 0, unit: 'kg', verificationStatus: 'UNKNOWN' }));
    expect(row).toMatchObject({ value: NOT_KNOWN, known: false, verified: false });
  });

  it('says "Not known" when every value is empty, never 0', () => {
    expect(describeSpec(spec({ unit: 'kg' })).value).toBe(NOT_KNOWN);
  });

  it('keeps a genuine zero', () => {
    expect(describeSpec(spec({ numericValue: 0, unit: 'mm' })).value).toBe('0 mm');
  });

  it('prefers text values', () => {
    expect(describeSpec(spec({ textValue: ' Diesel ' })).value).toBe('Diesel');
  });
});

describe('describeSpecs', () => {
  it('uses definition names and sorts by label', () => {
    const rows = describeSpecs(
      [
        spec({ definitionCode: 'zeta_reach', id: '00000000-0000-4000-8000-00000000000a' }),
        spec({}),
      ],
      [{ ...weight, displayName: 'Weight in service' }],
    );
    expect(rows.map((r) => r.label)).toEqual(['Weight in service', 'Zeta reach']);
  });
});
