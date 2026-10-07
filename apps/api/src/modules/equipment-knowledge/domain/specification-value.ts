import type { Unit } from '@ee/contracts';
import type { SpecificationDefinition, SpecificationValue } from './entities';
import {
  InvalidSpecificationRangeError,
  InvalidSpecificationShapeError,
  InvalidSpecificationValueError,
} from './errors';
import { convert } from './units';

export interface SpecificationValueInput {
  numericValue?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: Unit | null;
  textValue?: string | null;
}

function checkNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new InvalidSpecificationValueError(`${name} must be finite`);
  if (value < 0) throw new InvalidSpecificationValueError(`${name} must not be negative`);
}

/**
 * Validates a value against its definition and computes the canonical-unit values.
 * Shapes: single (numericValue + unit), range (minValue + maxValue + unit), text, or empty.
 */
export function resolveSpecificationValue(
  definition: Pick<SpecificationDefinition, 'valueType' | 'canonicalUnit'>,
  input: SpecificationValueInput,
): SpecificationValue {
  const numericValue = input.numericValue ?? null;
  const minValue = input.minValue ?? null;
  const maxValue = input.maxValue ?? null;
  const unit = input.unit ?? null;
  const textValue = input.textValue ?? null;

  const empty: SpecificationValue = {
    numericValue: null,
    minValue: null,
    maxValue: null,
    unit: null,
    textValue: null,
    normalizedMin: null,
    normalizedMax: null,
  };

  const hasSingle = numericValue !== null;
  const hasRange = minValue !== null || maxValue !== null;
  const hasText = textValue !== null;

  if ([hasSingle, hasRange, hasText].filter(Boolean).length > 1) {
    throw new InvalidSpecificationShapeError(
      'Provide only one of a single value, a range, or a text value',
    );
  }

  if (hasText) {
    if (unit !== null) throw new InvalidSpecificationShapeError('A text value cannot have a unit');
    if (definition.valueType !== 'TEXT') {
      throw new InvalidSpecificationShapeError('This specification expects a numeric value');
    }
    return { ...empty, textValue };
  }

  if (!hasSingle && !hasRange) {
    if (unit !== null) throw new InvalidSpecificationShapeError('A unit needs a value');
    return empty;
  }

  if (definition.valueType !== 'NUMERIC' || definition.canonicalUnit === null) {
    throw new InvalidSpecificationShapeError('This specification expects a text value');
  }
  if (unit === null) throw new InvalidSpecificationShapeError('A numeric value needs a unit');
  const canonical = definition.canonicalUnit;

  if (hasSingle) {
    checkNumber('numericValue', numericValue);
    const normalized = convert(numericValue, unit, canonical);
    return { ...empty, numericValue, unit, normalizedMin: normalized, normalizedMax: normalized };
  }

  if (minValue === null || maxValue === null) {
    throw new InvalidSpecificationShapeError('A range needs both minValue and maxValue');
  }
  checkNumber('minValue', minValue);
  checkNumber('maxValue', maxValue);
  if (minValue > maxValue) throw new InvalidSpecificationRangeError();
  return {
    ...empty,
    minValue,
    maxValue,
    unit,
    normalizedMin: convert(minValue, unit, canonical),
    normalizedMax: convert(maxValue, unit, canonical),
  };
}
