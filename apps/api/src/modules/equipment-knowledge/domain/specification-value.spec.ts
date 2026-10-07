import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '../../../platform/http';
import { resolveSpecificationValue, type SpecificationValueInput } from './specification-value';

const length = { valueType: 'NUMERIC', canonicalUnit: 'm' } as const;
const text = { valueType: 'TEXT', canonicalUnit: null } as const;

function rejects(
  definition: typeof length | typeof text,
  input: SpecificationValueInput,
  code: string,
) {
  assert.throws(
    () => resolveSpecificationValue(definition, input),
    (e: unknown) => e instanceof DomainError && e.code === code && e.status === 400,
    JSON.stringify(input),
  );
}

describe('resolveSpecificationValue', () => {
  it('normalizes a single value to the canonical unit', () => {
    assert.deepEqual(resolveSpecificationValue(length, { numericValue: 6720, unit: 'mm' }), {
      numericValue: 6720,
      minValue: null,
      maxValue: null,
      unit: 'mm',
      textValue: null,
      normalizedMin: 6.72,
      normalizedMax: 6.72,
    });
  });

  it('normalizes a range', () => {
    const value = resolveSpecificationValue(length, { minValue: 5500, maxValue: 6720, unit: 'mm' });
    assert.equal(value.minValue, 5500);
    assert.equal(value.maxValue, 6720);
    assert.equal(value.normalizedMin, 5.5);
    assert.equal(value.normalizedMax, 6.72);
    assert.equal(value.numericValue, null);
  });

  it('accepts an equal min and max', () => {
    const value = resolveSpecificationValue(length, { minValue: 3, maxValue: 3, unit: 'm' });
    assert.equal(value.normalizedMin, 3);
  });

  it('accepts text on a TEXT definition', () => {
    const value = resolveSpecificationValue(text, { textValue: 'Diesel' });
    assert.equal(value.textValue, 'Diesel');
    assert.equal(value.unit, null);
    assert.equal(value.normalizedMin, null);
  });

  it('accepts nothing as an unknown value', () => {
    for (const definition of [length, text]) {
      const value = resolveSpecificationValue(definition, {
        numericValue: null,
        textValue: null,
      });
      assert.ok(Object.values(value).every((v) => v === null));
    }
  });

  it('rejects mixed shapes', () => {
    rejects(
      length,
      { numericValue: 1, minValue: 1, maxValue: 2, unit: 'm' },
      'invalid_specification_shape',
    );
    rejects(length, { numericValue: 1, unit: 'm', textValue: 'x' }, 'invalid_specification_shape');
    rejects(text, { minValue: 1, maxValue: 2, textValue: 'x' }, 'invalid_specification_shape');
  });

  it('rejects incomplete shapes', () => {
    rejects(length, { numericValue: 1 }, 'invalid_specification_shape');
    rejects(length, { unit: 'm' }, 'invalid_specification_shape');
    rejects(length, { minValue: 1, unit: 'm' }, 'invalid_specification_shape');
    rejects(length, { maxValue: 1, unit: 'm' }, 'invalid_specification_shape');
    rejects(text, { textValue: 'x', unit: 'm' }, 'invalid_specification_shape');
  });

  it('rejects a value type that does not match the definition', () => {
    rejects(length, { textValue: 'long' }, 'invalid_specification_shape');
    rejects(text, { numericValue: 1, unit: 'm' }, 'invalid_specification_shape');
  });

  it('rejects negative and non-finite values', () => {
    rejects(length, { numericValue: -1, unit: 'm' }, 'invalid_specification_value');
    rejects(length, { minValue: -1, maxValue: 2, unit: 'm' }, 'invalid_specification_value');
    rejects(length, { numericValue: Number.NaN, unit: 'm' }, 'invalid_specification_value');
    rejects(length, { numericValue: Infinity, unit: 'm' }, 'invalid_specification_value');
    rejects(length, { minValue: 0, maxValue: Infinity, unit: 'm' }, 'invalid_specification_value');
  });

  it('rejects a reversed range', () => {
    rejects(length, { minValue: 7, maxValue: 6, unit: 'm' }, 'invalid_specification_range');
  });

  it('rejects a unit from another dimension', () => {
    rejects(length, { numericValue: 20, unit: 'kg' }, 'incompatible_unit');
    rejects(length, { minValue: 1, maxValue: 2, unit: 'hp' }, 'incompatible_unit');
  });
});
