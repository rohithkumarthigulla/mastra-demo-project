import type { CreateListingRequest } from '@ee/contracts';
import { useState } from 'react';
import type { FieldErrors } from '../auth';
import { useCities } from '../rental';
import { Button, ErrorMessage, Select, TextField } from '../ui';
import { emptyListingForm, validateListingForm, type ListingFormValues } from './listingForm';
import { ModelPicker } from './ModelPicker';

interface ListingEditorProps {
  initial?: ListingFormValues;
  /** Label for the initially selected model, e.g. "JCB 3DX". */
  initialModelLabel?: string;
  submitLabel: string;
  submitting: boolean;
  /** Errors from the API (field or form level). */
  fieldErrors?: FieldErrors;
  formError?: string;
  onSubmit: (value: CreateListingRequest) => void;
}

export function ListingEditor({
  initial = emptyListingForm,
  initialModelLabel,
  submitLabel,
  submitting,
  fieldErrors = {},
  formError,
  onSubmit,
}: ListingEditorProps) {
  const [values, setValues] = useState(initial);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const { cities, isLoading: citiesLoading } = useCities();
  const errors = { ...fieldErrors, ...localErrors };

  const set = (key: keyof ListingFormValues) => (text: string) => {
    setValues((prev) => ({ ...prev, [key]: text }));
    setLocalErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function submit() {
    const result = validateListingForm(values);
    if (!result.ok) {
      setLocalErrors(result.errors);
      return;
    }
    setLocalErrors({});
    onSubmit(result.value);
  }

  return (
    <>
      <ErrorMessage message={formError} />
      <ModelPicker
        value={values.modelId}
        onChange={set('modelId')}
        error={errors.modelId}
        selectedLabel={initialModelLabel}
      />
      <Select
        label="City"
        value={values.cityGeoId}
        options={cities.map((c) => ({ value: c.geoId, label: c.name, description: c.state }))}
        loading={citiesLoading}
        onChange={set('cityGeoId')}
        error={errors.cityGeoId}
      />
      <TextField
        label="Title"
        value={values.title}
        onChangeText={set('title')}
        maxLength={120}
        error={errors.title}
      />
      <TextField
        label="Description"
        value={values.description}
        onChangeText={set('description')}
        multiline
        numberOfLines={4}
        maxLength={2000}
        error={errors.description}
      />
      <TextField
        label="Location"
        placeholder="Yard or site address"
        value={values.location}
        onChangeText={set('location')}
        maxLength={160}
        error={errors.location}
      />
      <TextField
        label="Price per day (₹)"
        placeholder="12500"
        keyboardType="decimal-pad"
        value={values.pricePerDay}
        onChangeText={set('pricePerDay')}
        error={errors.pricePerDay}
      />
      <Button title={submitLabel} loading={submitting} onPress={submit} />
    </>
  );
}
