import {
  MAX_LISTING_PAGE_LIMIT,
  type AssetIdentifierType,
  type UnitCondition,
} from '@ee/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from '../auth';
import type { FieldErrors } from '../auth/formErrors';
import { queryKeys } from '../rental';
import { useTheme } from '../theme';
import { Button, Chips, ErrorMessage, Select, TextField } from '../ui';
import { useYards } from './fleetApi';
import { CONDITION_LABELS, IDENTIFIER_LABELS, type UnitFormValues } from './unitForm';

const CONDITIONS = Object.entries(CONDITION_LABELS).map(([value, label]) => ({
  value: value as UnitCondition,
  label,
}));

interface UnitEditorProps {
  initial: UnitFormValues;
  /** The listing can only be chosen when adding; a machine never moves listing. */
  listingLocked?: boolean;
  submitLabel: string;
  submitting: boolean;
  fieldErrors: FieldErrors;
  formError?: string | null;
  onSubmit: (values: UnitFormValues) => void;
}

export function UnitEditor({
  initial,
  listingLocked = false,
  submitLabel,
  submitting,
  fieldErrors,
  formError,
  onSubmit,
}: UnitEditorProps) {
  const { api } = useSession();
  const theme = useTheme();
  const [values, setValues] = useState(initial);
  const yards = useYards(api);
  const listings = useQuery({
    queryKey: [...queryKeys.supplierListings(), 'picker'],
    queryFn: () => api.supplierListings.list({ limit: MAX_LISTING_PAGE_LIMIT, offset: 0 }),
    enabled: !listingLocked,
  });

  const set =
    <K extends keyof UnitFormValues>(key: K) =>
    (value: UnitFormValues[K]) =>
      setValues((v) => ({ ...v, [key]: value }));
  const setIdentifier = (type: AssetIdentifierType) => (value: string) =>
    setValues((v) => ({ ...v, identifiers: { ...v.identifiers, [type]: value } }));

  return (
    <View style={{ gap: theme.spacing.md, maxWidth: 520 }}>
      {listingLocked ? null : (
        <Select
          label="Listing"
          value={values.listingId}
          options={(listings.data?.items ?? []).map((l) => ({
            value: l.id,
            label: l.title,
            description: `${l.model.manufacturer.name} ${l.model.modelName}`,
          }))}
          loading={listings.isLoading}
          onChange={set('listingId')}
          error={fieldErrors.listingId}
        />
      )}
      <Select
        label="Yard"
        value={values.yardId}
        options={(yards.data ?? []).map((y) => ({
          value: y.id,
          label: y.name,
          description: y.city.name,
        }))}
        loading={yards.isLoading}
        placeholder={yards.data?.length === 0 ? 'Add a yard on the fleet screen first' : undefined}
        onChange={set('yardId')}
        error={fieldErrors.yardId}
      />
      <TextField
        label="Model year"
        value={values.modelYear}
        onChangeText={set('modelYear')}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="e.g. 2021"
        error={fieldErrors.modelYear}
      />
      <View style={{ gap: theme.spacing.xs }}>
        <Chips
          label="Condition"
          value={values.condition}
          options={CONDITIONS}
          onChange={set('condition')}
        />
        <ErrorMessage message={fieldErrors.condition ?? null} />
      </View>
      <TextField
        label="Label (optional)"
        value={values.label}
        onChangeText={set('label')}
        maxLength={80}
        placeholder="e.g. Unit A"
        error={fieldErrors.label}
      />
      {(Object.keys(IDENTIFIER_LABELS) as AssetIdentifierType[]).map((type) => (
        <TextField
          key={type}
          label={`${IDENTIFIER_LABELS[type]} (optional)`}
          value={values.identifiers[type]}
          onChangeText={setIdentifier(type)}
          maxLength={80}
          autoCapitalize="characters"
        />
      ))}
      <ErrorMessage message={fieldErrors.identifiers ?? formError ?? null} />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button title={submitLabel} loading={submitting} onPress={() => onSubmit(values)} />
      </View>
    </View>
  );
}
