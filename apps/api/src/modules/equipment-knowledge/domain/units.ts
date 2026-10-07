import type { Unit } from '@ee/contracts';
import { IncompatibleUnitError } from './errors';

export type { Unit };
export type Dimension = 'mass' | 'length' | 'power' | 'volume';

/** Factor converts a value in this unit to the dimension's base unit (kg, m, kW, m3). */
const UNITS: Record<Unit, { dimension: Dimension; factor: number }> = {
  kg: { dimension: 'mass', factor: 1 },
  t: { dimension: 'mass', factor: 1000 },
  mm: { dimension: 'length', factor: 0.001 },
  m: { dimension: 'length', factor: 1 },
  kW: { dimension: 'power', factor: 1 },
  hp: { dimension: 'power', factor: 0.7457 },
  m3: { dimension: 'volume', factor: 1 },
};

export function dimensionOf(unit: Unit): Dimension {
  return UNITS[unit].dimension;
}

/** Removes float noise such as 6.720000000000001 so stored values compare exactly. */
export function roundNormalized(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function convert(value: number, from: Unit, to: Unit): number {
  if (dimensionOf(from) !== dimensionOf(to)) throw new IncompatibleUnitError(from, to);
  return roundNormalized((value * UNITS[from].factor) / UNITS[to].factor);
}
