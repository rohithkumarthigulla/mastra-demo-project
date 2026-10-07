import { putRateCardSchema, type PutRateCardRequest, type RateCardDto } from '@ee/contracts';
import type { FieldErrors } from '../auth/formErrors';
import { parsePrice } from './listingForm';

export const RATE_CARD_FIELDS = [
  { key: 'weekRate', label: 'Week rate' },
  { key: 'monthRate', label: 'Month rate' },
  { key: 'transportFee', label: 'Transport fee' },
  { key: 'operatorRatePerDay', label: 'Operator rate per day' },
  { key: 'depositAmount', label: 'Deposit' },
] as const satisfies readonly { key: keyof PutRateCardRequest; label: string }[];

export type RateCardFormValues = Record<keyof PutRateCardRequest, string>;

export function rateCardToForm(card: RateCardDto | undefined): RateCardFormValues {
  const text = (value: number | null | undefined) => (value == null ? '' : String(value));
  return {
    weekRate: text(card?.weekRate),
    monthRate: text(card?.monthRate),
    transportFee: text(card?.transportFee),
    operatorRatePerDay: text(card?.operatorRatePerDay),
    depositAmount: text(card?.depositAmount),
  };
}

/** Blank fields clear the amount; the whole card is sent as the API replaces it. */
export function validateRateCard(
  values: RateCardFormValues,
): { ok: true; value: PutRateCardRequest } | { ok: false; errors: FieldErrors } {
  const body: Record<string, number | null> = {};
  const errors: FieldErrors = {};
  for (const { key } of RATE_CARD_FIELDS) {
    const text = values[key].trim();
    if (!text) {
      body[key] = null;
      continue;
    }
    const amount = parsePrice(text);
    if (Number.isNaN(amount)) {
      errors[key] = 'Enter an amount in rupees, e.g. 4500.';
      body[key] = null;
    } else body[key] = amount;
  }
  const parsed = putRateCardSchema.safeParse(body);
  if (parsed.success && Object.keys(errors).length === 0) return { ok: true, value: parsed.data };
  for (const issue of parsed.error?.issues ?? []) {
    errors[String(issue.path[0])] ??=
      'Enter a valid amount with at most 2 decimals, up to ₹10,00,000 per rate.';
  }
  return { ok: false, errors };
}
