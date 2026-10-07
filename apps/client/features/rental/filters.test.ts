import { describe, expect, it } from 'vitest';
import { browseQuery, filtersFromParams, filtersToParams, hasActiveFilters } from './filters';

const MODEL = '0b5d6f3a-2c1e-4b7a-9d8e-1f2a3b4c5d6e';

describe('listing filters in the URL', () => {
  it('round-trips filters and page', () => {
    const filters = {
      city: 'IN-HYD',
      category: 'EXCAVATOR',
      manufacturer: MODEL,
      minPrice: 5000,
      maxPrice: 20000.5,
      q: 'jcb',
    };
    const params = filtersToParams(filters, 3);
    expect(params).toEqual({
      city: 'IN-HYD',
      category: 'EXCAVATOR',
      manufacturer: MODEL,
      minPrice: '5000',
      maxPrice: '20000.5',
      q: 'jcb',
      page: '3',
    });
    expect(filtersFromParams(params)).toEqual({ filters, page: 3 });
  });

  it('leaves out empty values and page 1', () => {
    expect(filtersToParams({ city: 'IN-HYD', q: '' }, 1)).toEqual({ city: 'IN-HYD' });
  });

  it('drops invalid values but keeps the rest', () => {
    const { filters, page } = filtersFromParams({
      city: 'IN-BLR',
      manufacturer: 'not-a-uuid',
      minPrice: 'cheap',
      maxPrice: '-5',
      page: 'two',
    });
    expect(filters).toEqual({ city: 'IN-BLR' });
    expect(page).toBe(1);
  });

  it('drops a price range whose minimum exceeds its maximum', () => {
    const { filters } = filtersFromParams({ city: 'IN-HYD', minPrice: '900', maxPrice: '100' });
    expect(filters).toEqual({ city: 'IN-HYD' });
  });

  it('takes the first of repeated params and trims whitespace', () => {
    expect(filtersFromParams({ city: ['  IN-HYD ', 'IN-BLR'], q: '   ' }).filters).toEqual({
      city: 'IN-HYD',
    });
  });

  it('builds the API query with paging', () => {
    expect(browseQuery({ city: 'IN-HYD' }, 3, 20)).toEqual({
      city: 'IN-HYD',
      limit: 20,
      offset: 40,
    });
  });

  it('does not count the model page filter as a builder filter', () => {
    expect(hasActiveFilters({ modelId: MODEL })).toBe(false);
    expect(hasActiveFilters({ minPrice: 0 })).toBe(true);
  });
});
