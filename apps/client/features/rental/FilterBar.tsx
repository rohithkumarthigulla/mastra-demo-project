import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { parsePrice } from '../supplier/listingForm';
import { useTheme } from '../theme';
import { Button, Select, TextField, useIsWide } from '../ui';
import type { ListingFilters } from './filters';
import { useCategories, useCities, useManufacturers } from './useCatalogue';

interface FilterBarProps {
  filters: ListingFilters;
  onChange: (filters: ListingFilters) => void;
}

function priceText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

/** Pickers apply straight away; typed fields (search, prices) apply on submit. */
export function FilterBar({ filters, onChange }: FilterBarProps) {
  const theme = useTheme();
  const wide = useIsWide();
  const { cities, isLoading: citiesLoading } = useCities();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { manufacturers, isLoading: manufacturersLoading } = useManufacturers();

  const [q, setQ] = useState(filters.q ?? '');
  const [minPrice, setMinPrice] = useState(priceText(filters.minPrice));
  const [maxPrice, setMaxPrice] = useState(priceText(filters.maxPrice));
  const [priceError, setPriceError] = useState<string>();

  // Follow the URL when it changes underneath us (back/forward, shared link).
  useEffect(() => setQ(filters.q ?? ''), [filters.q]);
  useEffect(() => setMinPrice(priceText(filters.minPrice)), [filters.minPrice]);
  useEffect(() => setMaxPrice(priceText(filters.maxPrice)), [filters.maxPrice]);

  function set(patch: Partial<ListingFilters>) {
    onChange({ ...filters, ...patch });
  }

  function applyText() {
    const min = minPrice.trim() ? parsePrice(minPrice) : undefined;
    const max = maxPrice.trim() ? parsePrice(maxPrice) : undefined;
    if ((min !== undefined && !(min >= 0)) || (max !== undefined && !(max >= 0))) {
      setPriceError('Enter prices as numbers, e.g. 5000');
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError('Minimum price must not be above the maximum');
      return;
    }
    setPriceError(undefined);
    set({ q: q.trim() || undefined, minPrice: min, maxPrice: max });
  }

  const column = { flex: wide ? 1 : undefined, minWidth: wide ? 180 : undefined };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.spacing.sm }}>
        <View style={column}>
          <Select
            label="City"
            value={filters.city ?? ''}
            allowClear
            placeholder="Any city"
            loading={citiesLoading}
            options={cities.map((c) => ({ value: c.geoId, label: c.name, description: c.state }))}
            onChange={(city) => set({ city: city || undefined })}
          />
        </View>
        <View style={column}>
          <Select
            label="Category"
            value={filters.category ?? ''}
            allowClear
            placeholder="Any category"
            loading={categoriesLoading}
            options={categories.map((c) => ({ value: c.code, label: c.displayName }))}
            onChange={(category) => set({ category: category || undefined })}
          />
        </View>
        <View style={column}>
          <Select
            label="Manufacturer"
            value={filters.manufacturer ?? ''}
            allowClear
            placeholder="Any manufacturer"
            loading={manufacturersLoading}
            options={manufacturers.map((m) => ({ value: m.id, label: m.name }))}
            onChange={(manufacturer) => set({ manufacturer: manufacturer || undefined })}
          />
        </View>
      </View>
      <View
        style={{
          flexDirection: wide ? 'row' : 'column',
          gap: theme.spacing.sm,
          alignItems: wide ? 'flex-end' : 'stretch',
        }}
      >
        <View style={{ flex: wide ? 2 : undefined }}>
          <TextField
            label="Search"
            value={q}
            onChangeText={setQ}
            placeholder="Title or description"
            returnKeyType="search"
            onSubmitEditing={applyText}
          />
        </View>
        <View style={column}>
          <TextField
            label="Min ₹ / day"
            value={minPrice}
            onChangeText={setMinPrice}
            keyboardType="decimal-pad"
            onSubmitEditing={applyText}
            error={priceError}
          />
        </View>
        <View style={column}>
          <TextField
            label="Max ₹ / day"
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="decimal-pad"
            onSubmitEditing={applyText}
          />
        </View>
        <Button title="Apply" onPress={applyText} />
      </View>
    </View>
  );
}
