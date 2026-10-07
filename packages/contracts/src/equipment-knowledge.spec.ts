import { describe, expect, it } from 'vitest';
import { listEquipmentModelsQuerySchema, specFilterSchema } from './equipment-knowledge.js';

describe('specFilterSchema', () => {
  it('parses CODE:bound:VALUE:UNIT', () => {
    expect(specFilterSchema.parse('MAX_DIGGING_DEPTH:min:5000:mm')).toEqual({
      code: 'MAX_DIGGING_DEPTH',
      bound: 'min',
      value: 5000,
      unit: 'mm',
    });
    expect(specFilterSchema.parse('OPERATING_WEIGHT:max:24.5:t')).toEqual({
      code: 'OPERATING_WEIGHT',
      bound: 'max',
      value: 24.5,
      unit: 't',
    });
  });

  it.each([
    'MAX_DIGGING_DEPTH',
    'MAX_DIGGING_DEPTH:min:5',
    'MAX_DIGGING_DEPTH:above:5:m',
    'MAX_DIGGING_DEPTH:min:-5:m',
    'MAX_DIGGING_DEPTH:min:abc:m',
    'MAX_DIGGING_DEPTH:min:5:ft',
    'max_digging_depth:min:5:m',
    'MAX_DIGGING_DEPTH:min:5:m:extra',
  ])('rejects %s', (raw) => {
    expect(specFilterSchema.safeParse(raw).success).toBe(false);
  });
});

describe('listEquipmentModelsQuerySchema', () => {
  it('defaults to active models with no spec filters', () => {
    expect(listEquipmentModelsQuerySchema.parse({})).toEqual({
      spec: [],
      status: 'ACTIVE',
      limit: 50,
      offset: 0,
    });
  });

  it('accepts one spec as a string and several as an array', () => {
    expect(
      listEquipmentModelsQuerySchema.parse({ spec: 'MAX_DIGGING_DEPTH:min:5:m' }).spec,
    ).toHaveLength(1);
    expect(
      listEquipmentModelsQuerySchema.parse({
        spec: ['MAX_DIGGING_DEPTH:min:5:m', 'OPERATING_WEIGHT:max:25:t'],
      }).spec,
    ).toHaveLength(2);
  });

  it('rejects too many spec filters and a page above 200', () => {
    expect(
      listEquipmentModelsQuerySchema.safeParse({
        spec: Array.from({ length: 11 }, () => 'MAX_DIGGING_DEPTH:min:5:m'),
      }).success,
    ).toBe(false);
    expect(listEquipmentModelsQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
  });
});
