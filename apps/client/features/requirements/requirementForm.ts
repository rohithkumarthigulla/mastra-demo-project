import {
  createRequirementSchema,
  type CreateRequirementRequest,
  type DraftRequirementDto,
} from '@ee/contracts';
import { fieldErrorsFromZod, type FieldErrors } from '../auth/formErrors';
import { validateRentalDates } from '../rental/estimate';

/** What the requirement form holds: text inputs as typed, plus picked category and city. */
export interface RequirementFormValues {
  title: string;
  categoryCode: string;
  cityGeoId: string;
  startDate: string;
  endDate: string;
  quantity: string;
  budgetPerDay: string;
  notes: string;
}

export function emptyRequirementForm(today: string): RequirementFormValues {
  return {
    title: '',
    categoryCode: '',
    cityGeoId: '',
    startDate: today,
    endDate: today,
    quantity: '1',
    budgetPerDay: '',
    notes: '',
  };
}

/** Route params that carry an assistant draft into the requirement form. */
export type RequirementDraftParams = Partial<
  Record<
    'title' | 'categoryCode' | 'cityGeoId' | 'startDate' | 'endDate' | 'quantity' | 'notes',
    string
  >
>;

export function draftToRequirementParams(draft: DraftRequirementDto): RequirementDraftParams {
  const params: RequirementDraftParams = {
    title: draft.title,
    categoryCode: draft.categoryCode,
    quantity: String(draft.quantity),
  };
  if (draft.cityGeoId) params.cityGeoId = draft.cityGeoId;
  if (draft.startDate) params.startDate = draft.startDate;
  if (draft.endDate) params.endDate = draft.endDate;
  if (draft.notes) params.notes = draft.notes;
  return params;
}

/** Starts the form from route params, falling back to an empty form for anything missing. */
export function requirementFormFromParams(
  params: Record<string, string | string[] | undefined>,
  today: string,
): RequirementFormValues {
  const form = emptyRequirementForm(today);
  const keys: (keyof RequirementDraftParams)[] = [
    'title',
    'categoryCode',
    'cityGeoId',
    'startDate',
    'endDate',
    'quantity',
    'notes',
  ];
  for (const key of keys) {
    const value = params[key];
    if (typeof value === 'string' && value !== '') form[key] = value;
  }
  return form;
}

export type RequirementFormResult =
  { ok: true; value: CreateRequirementRequest } | { ok: false; errors: FieldErrors };

const FRIENDLY: Partial<Record<keyof RequirementFormValues, string>> = {
  title: 'Give the requirement a title of 3 to 120 characters.',
  categoryCode: 'Choose an equipment category.',
  cityGeoId: 'Choose the city of the site.',
  quantity: 'Enter how many machines you need, from 1 to 20.',
  budgetPerDay: 'Enter a budget per day in rupees, e.g. 12000, or leave it empty.',
};

/** Parses typed rupees or counts like "12,500"; NaN when it isn't a number. */
function parseNumber(text: string): number {
  const cleaned = text.replace(/[₹,\s]/g, '');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/**
 * Validates with the schema the API uses, plus the same date messages as the request form,
 * so mistakes show next to the field without a round trip.
 */
export function validateRequirementForm(
  values: RequirementFormValues,
  today?: string,
): RequirementFormResult {
  const budget = values.budgetPerDay.trim();
  const notes = values.notes.trim();
  const parsed = createRequirementSchema.safeParse({
    title: values.title,
    categoryCode: values.categoryCode,
    cityGeoId: values.cityGeoId,
    startDate: values.startDate.trim(),
    endDate: values.endDate.trim(),
    quantity: parseNumber(values.quantity),
    ...(budget ? { budgetPerDay: parseNumber(budget) } : {}),
    ...(notes ? { notes } : {}),
  });

  const errors: FieldErrors = parsed.success ? {} : fieldErrorsFromZod(parsed.error);
  for (const key of Object.keys(FRIENDLY) as (keyof RequirementFormValues)[]) {
    if (errors[key]) errors[key] = FRIENDLY[key];
  }
  // Date messages come from the shared helper so both forms read the same.
  delete errors.startDate;
  delete errors.endDate;
  Object.assign(errors, validateRentalDates(values.startDate.trim(), values.endDate.trim(), today));

  if (parsed.success && Object.keys(errors).length === 0) return { ok: true, value: parsed.data };
  return { ok: false, errors };
}
