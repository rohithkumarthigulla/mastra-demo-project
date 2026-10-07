import {
  createUnitRequestSchema,
  createYardRequestSchema,
  updateUnitRequestSchema,
  type AssetIdentifierType,
  type CreateUnitRequest,
  type CreateYardRequest,
  type EquipmentUnitDto,
  type UnitCondition,
  type UpdateUnitRequest,
  type YardDto,
} from '@ee/contracts';
import { fieldErrorsFromZod, type FieldErrors } from '../auth/formErrors';

export const CONDITION_LABELS: Record<UnitCondition, string> = {
  NEW: 'New',
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

export const IDENTIFIER_LABELS: Record<AssetIdentifierType, string> = {
  SERIAL_NUMBER: 'Serial number',
  REGISTRATION_NUMBER: 'Registration number',
  ENGINE_NUMBER: 'Engine number',
};

const IDENTIFIER_TYPES = Object.keys(IDENTIFIER_LABELS) as AssetIdentifierType[];

/** The machine form: text inputs as typed, one optional field per identifier type. */
export interface UnitFormValues {
  listingId: string;
  yardId: string;
  modelYear: string;
  condition: UnitCondition | '';
  label: string;
  identifiers: Record<AssetIdentifierType, string>;
}

export const emptyUnitForm = (listingId = ''): UnitFormValues => ({
  listingId,
  yardId: '',
  modelYear: '',
  condition: '',
  label: '',
  identifiers: { SERIAL_NUMBER: '', REGISTRATION_NUMBER: '', ENGINE_NUMBER: '' },
});

export function unitToForm(unit: EquipmentUnitDto): UnitFormValues {
  const form = emptyUnitForm(unit.listing.id);
  for (const identifier of unit.identifiers) form.identifiers[identifier.type] = identifier.value;
  return {
    ...form,
    yardId: unit.yard.id,
    modelYear: String(unit.modelYear),
    condition: unit.condition,
    label: unit.label ?? '',
  };
}

const FRIENDLY: FieldErrors = {
  listingId: 'Choose the listing this machine belongs to.',
  yardId: 'Choose the yard it is kept at.',
  modelYear: 'Enter a year between 1950 and 2100.',
  condition: 'Choose a condition.',
};

function parseYear(text: string): number {
  return /^\d{4}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

function identifiers(values: UnitFormValues) {
  return IDENTIFIER_TYPES.filter((type) => values.identifiers[type].trim()).map((type) => ({
    type,
    value: values.identifiers[type].trim(),
  }));
}

function friendly(errors: FieldErrors): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, message] of Object.entries(errors)) out[key] = FRIENDLY[key] ?? message;
  return out;
}

export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export function validateNewUnit(values: UnitFormValues): FormResult<CreateUnitRequest> {
  const parsed = createUnitRequestSchema.safeParse({
    listingId: values.listingId,
    yardId: values.yardId,
    modelYear: parseYear(values.modelYear),
    condition: values.condition || undefined,
    label: values.label.trim() || undefined,
    identifiers: identifiers(values),
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, errors: friendly(fieldErrorsFromZod(parsed.error)) };
}

/**
 * Only the fields that differ from the saved machine. `null` when nothing changed.
 * The identifier set is sent whole whenever any of it changed, as the API replaces it.
 */
export function validateUnitChanges(
  unit: EquipmentUnitDto,
  values: UnitFormValues,
): FormResult<UpdateUnitRequest | null> {
  const before = unitToForm(unit);
  const body: Record<string, unknown> = {};
  if (values.yardId !== before.yardId) body.yardId = values.yardId;
  if (values.modelYear.trim() !== before.modelYear) body.modelYear = parseYear(values.modelYear);
  if (values.condition !== before.condition) body.condition = values.condition || undefined;
  if (values.label.trim() !== before.label) body.label = values.label.trim() || null;
  if (IDENTIFIER_TYPES.some((t) => values.identifiers[t].trim() !== before.identifiers[t])) {
    body.identifiers = identifiers(values);
  }
  if (Object.keys(body).length === 0) return { ok: true, value: null };
  const parsed = updateUnitRequestSchema.safeParse(body);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, errors: friendly(fieldErrorsFromZod(parsed.error)) };
}

export interface YardFormValues {
  name: string;
  cityGeoId: string;
  address: string;
}

export const yardToForm = (yard?: YardDto): YardFormValues => ({
  name: yard?.name ?? '',
  cityGeoId: yard?.city.geoId ?? '',
  address: yard?.address ?? '',
});

export function validateYard(values: YardFormValues): FormResult<CreateYardRequest> {
  const parsed = createYardRequestSchema.safeParse(values);
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors = fieldErrorsFromZod(parsed.error);
  if (errors.name) errors.name = 'Enter a yard name (up to 80 characters).';
  if (errors.cityGeoId) errors.cityGeoId = 'Choose a city.';
  return { ok: false, errors };
}

/** Machines grouped under their listing, listings in title order, active machines first. */
export function groupUnitsByListing(units: EquipmentUnitDto[]) {
  const groups = new Map<
    string,
    { listing: EquipmentUnitDto['listing']; units: EquipmentUnitDto[] }
  >();
  for (const unit of units) {
    const group = groups.get(unit.listing.id) ?? { listing: unit.listing, units: [] };
    group.units.push(unit);
    groups.set(unit.listing.id, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.listing.title.localeCompare(b.listing.title))
    .map((group) => ({
      ...group,
      active: group.units.filter((u) => u.status === 'ACTIVE').length,
      units: [...group.units].sort(
        (a, b) =>
          Number(a.status !== 'ACTIVE') - Number(b.status !== 'ACTIVE') ||
          unitName(a).localeCompare(unitName(b)),
      ),
    }));
}

/** How a machine is named in lists: its label, else the model and year. */
export function unitName(unit: Pick<EquipmentUnitDto, 'label' | 'model' | 'modelYear'>): string {
  return unit.label ?? `${unit.model.modelName} (${unit.modelYear})`;
}
