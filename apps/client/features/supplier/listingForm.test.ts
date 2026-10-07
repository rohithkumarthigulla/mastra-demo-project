import { describe, expect, it } from 'vitest';
import { changedFields, emptyListingForm, parsePrice, validateListingForm } from './listingForm';

const valid = {
  modelId: '0b5d6f3a-2c1e-4b7a-9d8e-1f2a3b4c5d6e',
  cityGeoId: 'IN-HYD',
  title: 'JCB 3DX backhoe loader',
  description: 'Well maintained, operator available on request.',
  location: 'Gachibowli',
  pricePerDay: '12,500.50',
};

describe('validateListingForm', () => {
  it('parses valid input into an API request', () => {
    const result = validateListingForm(valid);
    expect(result).toEqual({ ok: true, value: { ...valid, pricePerDay: 12500.5 } });
  });

  it('reports an error under every missing field', () => {
    const result = validateListingForm(emptyListingForm);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ['cityGeoId', 'description', 'location', 'modelId', 'pricePerDay', 'title'].sort(),
    );
    expect(result.errors.modelId).toBe('Choose an equipment model.');
    expect(result.errors.cityGeoId).toBe('Choose a city.');
    expect(result.errors.pricePerDay).toMatch(/rupees/);
  });

  it.each([
    ['0', /greater than 0/],
    ['1000000.01', /at most/],
    ['10.555', /two decimal/],
    ['abc', /rupees/],
    ['-5', /rupees/],
  ])('rejects a price of %s', (pricePerDay, message) => {
    const result = validateListingForm({ ...valid, pricePerDay });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.pricePerDay).toMatch(message);
  });

  it('rejects a short title and description', () => {
    const result = validateListingForm({ ...valid, title: 'ab', description: 'short' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['description', 'title']);
  });
});

describe('parsePrice', () => {
  it('accepts grouping, the rupee sign and spaces', () => {
    expect(parsePrice('₹ 1,00,000.25')).toBe(100000.25);
  });
  it('rejects anything else', () => {
    expect(parsePrice('')).toBeNaN();
    expect(parsePrice('1e5')).toBeNaN();
  });
});

describe('changedFields', () => {
  it('returns only the changed fields', () => {
    const before = { ...valid, pricePerDay: 100 };
    expect(changedFields(before, { ...before, title: 'New title', pricePerDay: 200 })).toEqual({
      title: 'New title',
      pricePerDay: 200,
    });
    expect(changedFields(before, before)).toEqual({});
  });
});
