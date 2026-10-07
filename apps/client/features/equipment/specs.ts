import type { EquipmentSpecificationDto, SpecificationDefinitionDto, Unit } from '@ee/contracts';

export const NOT_KNOWN = 'Not known';

export interface SpecRow {
  id: string;
  label: string;
  /** The value with its unit, or {@link NOT_KNOWN}. Never a guessed or zero placeholder. */
  value: string;
  known: boolean;
  verified: boolean;
}

const UNIT_LABEL: Record<Unit, string> = {
  kg: 'kg',
  t: 't',
  m: 'm',
  mm: 'mm',
  kW: 'kW',
  hp: 'hp',
  m3: 'm³',
};

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function withUnit(text: string, unit: Unit | null): string {
  return unit ? `${text} ${UNIT_LABEL[unit]}` : text;
}

/** The value as shown to a builder, or null when there's nothing trustworthy to show. */
function valueText(spec: EquipmentSpecificationDto): string | null {
  if (spec.verificationStatus === 'UNKNOWN' || spec.verificationStatus === 'DEPRECATED') {
    return null;
  }
  if (spec.textValue?.trim()) return spec.textValue.trim();
  if (spec.numericValue !== null) return withUnit(formatNumber(spec.numericValue), spec.unit);
  if (spec.minValue !== null && spec.maxValue !== null) {
    return withUnit(`${formatNumber(spec.minValue)}–${formatNumber(spec.maxValue)}`, spec.unit);
  }
  if (spec.minValue !== null) return withUnit(`at least ${formatNumber(spec.minValue)}`, spec.unit);
  if (spec.maxValue !== null) return withUnit(`up to ${formatNumber(spec.maxValue)}`, spec.unit);
  return null;
}

/** Turns a code like `operating_weight` into "Operating weight" when no definition is known. */
function humanize(code: string): string {
  const words = code.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function describeSpec(
  spec: EquipmentSpecificationDto,
  definitions: ReadonlyMap<string, SpecificationDefinitionDto> = new Map(),
): SpecRow {
  const value = valueText(spec);
  return {
    id: spec.id,
    label: definitions.get(spec.definitionCode)?.displayName ?? humanize(spec.definitionCode),
    value: value ?? NOT_KNOWN,
    known: value !== null,
    verified: value !== null && spec.verificationStatus === 'VERIFIED',
  };
}

/** Rows for a model's specification list, sorted by label. */
export function describeSpecs(
  specs: readonly EquipmentSpecificationDto[],
  definitions: readonly SpecificationDefinitionDto[] = [],
): SpecRow[] {
  const byCode = new Map(definitions.map((definition) => [definition.code, definition]));
  return specs
    .map((spec) => describeSpec(spec, byCode))
    .sort((a, b) => a.label.localeCompare(b.label));
}
