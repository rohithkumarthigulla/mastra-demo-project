import { describe, expect, it } from 'vitest';
import {
  browseListingsQuerySchema,
  createListingRequestSchema,
  updateListingRequestSchema,
} from './equipment-listing.js';

const valid = {
  modelId: '00000000-0000-4000-8000-000000000001',
  cityGeoId: 'IN-TG-HYD',
  title: 'JCB 3DX backhoe',
  description: 'Well maintained, operator available.',
  location: 'Gachibowli',
  pricePerDay: 4500.5,
};

describe('createListingRequestSchema', () => {
  it('accepts a valid listing and trims text', () => {
    const parsed = createListingRequestSchema.parse({ ...valid, title: '  JCB 3DX  ' });
    expect(parsed.title).toBe('JCB 3DX');
  });

  it('rejects zero, three decimals and prices above the cap', () => {
    for (const pricePerDay of [0, -1, 12.345, 1_000_000.01]) {
      expect(createListingRequestSchema.safeParse({ ...valid, pricePerDay }).success).toBe(false);
    }
    expect(createListingRequestSchema.safeParse({ ...valid, pricePerDay: 1_000_000 }).success).toBe(
      true,
    );
  });

  it('enforces text lengths', () => {
    expect(createListingRequestSchema.safeParse({ ...valid, title: 'ab' }).success).toBe(false);
    expect(createListingRequestSchema.safeParse({ ...valid, description: 'short' }).success).toBe(
      false,
    );
    expect(createListingRequestSchema.safeParse({ ...valid, location: 'x' }).success).toBe(false);
  });

  it('rejects unknown keys such as status or category', () => {
    expect(createListingRequestSchema.safeParse({ ...valid, status: 'ACTIVE' }).success).toBe(
      false,
    );
    expect(createListingRequestSchema.safeParse({ ...valid, category: 'EXCAVATOR' }).success).toBe(
      false,
    );
  });
});

describe('updateListingRequestSchema', () => {
  it('accepts a partial update but not an empty one or a status change', () => {
    expect(updateListingRequestSchema.safeParse({ pricePerDay: 100 }).success).toBe(true);
    expect(updateListingRequestSchema.safeParse({}).success).toBe(false);
    expect(updateListingRequestSchema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
  });
});

describe('browseListingsQuerySchema', () => {
  it('coerces query strings and applies defaults', () => {
    expect(browseListingsQuerySchema.parse({ minPrice: '100', limit: '5' })).toEqual({
      minPrice: 100,
      limit: 5,
      offset: 0,
    });
    expect(browseListingsQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 });
  });

  it('caps the limit at 100 and rejects inverted price ranges', () => {
    expect(browseListingsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(browseListingsQuerySchema.safeParse({ minPrice: '10', maxPrice: '5' }).success).toBe(
      false,
    );
    expect(browseListingsQuerySchema.safeParse({ minPrice: 'abc' }).success).toBe(false);
  });
});
