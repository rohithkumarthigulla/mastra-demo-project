import { describe, expect, it } from 'vitest';
import { rateCardToForm, validateRateCard } from './rateCardForm';

const LISTING = '0b5d6f3a-2c1e-4b7a-9d8e-1f2a3b4c5d6e';

describe('rate card form', () => {
  it('starts blank for a listing with no card', () => {
    expect(rateCardToForm(undefined)).toEqual({
      weekRate: '',
      monthRate: '',
      transportFee: '',
      operatorRatePerDay: '',
      depositAmount: '',
    });
  });

  it('round-trips a saved card, sending blanks as null', () => {
    const form = rateCardToForm({
      listingId: LISTING,
      weekRate: 75000,
      monthRate: null,
      transportFee: 4500.5,
      operatorRatePerDay: null,
      depositAmount: 25000,
      updatedAt: '2026-10-07T06:30:00.000Z',
    });
    expect(validateRateCard({ ...form, operatorRatePerDay: ' ₹1500 ' })).toEqual({
      ok: true,
      value: {
        weekRate: 75000,
        monthRate: null,
        transportFee: 4500.5,
        operatorRatePerDay: 1500,
        depositAmount: 25000,
      },
    });
  });

  it('rejects text, too many decimals and rates over the cap', () => {
    const result = validateRateCard({
      ...rateCardToForm(undefined),
      weekRate: 'abc',
      transportFee: '10.123',
      operatorRatePerDay: '2000000',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      'operatorRatePerDay',
      'transportFee',
      'weekRate',
    ]);
  });
});
