import {
  createListingRequestSchema,
  type CreateListingRequest,
  type EquipmentListingDto,
} from '@ee/contracts';
import { fieldErrorsFromZod, type FieldErrors } from '../auth/formErrors';

/** What the listing form holds: text inputs as typed, plus the picked model and city. */
export interface ListingFormValues {
  modelId: string;
  cityGeoId: string;
  title: string;
  description: string;
  location: string;
  pricePerDay: string;
}

export const emptyListingForm: ListingFormValues = {
  modelId: '',
  cityGeoId: '',
  title: '',
  description: '',
  location: '',
  pricePerDay: '',
};

export type ListingFormResult =
  { ok: true; value: CreateListingRequest } | { ok: false; errors: FieldErrors };

const FRIENDLY: Partial<Record<keyof ListingFormValues, string>> = {
  modelId: 'Choose an equipment model.',
  cityGeoId: 'Choose a city.',
};

/** Parses a typed price like "12,500.50" into rupees; NaN when it isn't a number. */
export function parsePrice(text: string): number {
  const cleaned = text.replace(/[₹,\s]/g, '');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/**
 * Validates the form with the same schema the API uses, so invalid input shows field
 * errors without a round trip.
 */
export function validateListingForm(values: ListingFormValues): ListingFormResult {
  const price = parsePrice(values.pricePerDay);
  const parsed = createListingRequestSchema.safeParse({ ...values, pricePerDay: price });
  if (parsed.success) return { ok: true, value: parsed.data };

  const errors = fieldErrorsFromZod(parsed.error);
  for (const key of Object.keys(FRIENDLY) as (keyof ListingFormValues)[]) {
    if (errors[key]) errors[key] = FRIENDLY[key];
  }
  if (errors.pricePerDay && Number.isNaN(price)) {
    errors.pricePerDay = 'Enter the price per day in rupees, e.g. 12500.';
  }
  return { ok: false, errors };
}

/** Form values for editing an existing listing. */
export function listingToForm(listing: EquipmentListingDto): ListingFormValues {
  return {
    modelId: listing.model.id,
    cityGeoId: listing.city.geoId,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    pricePerDay: listing.pricePerDay.toFixed(2),
  };
}

/** Only the fields that changed, for `PATCH`; empty when nothing changed. */
export function changedFields(
  before: CreateListingRequest,
  after: CreateListingRequest,
): Partial<CreateListingRequest> {
  const changes: Partial<CreateListingRequest> = {};
  for (const key of Object.keys(after) as (keyof CreateListingRequest)[]) {
    if (after[key] !== before[key]) (changes as Record<string, unknown>)[key] = after[key];
  }
  return changes;
}
