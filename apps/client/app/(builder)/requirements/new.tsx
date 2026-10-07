import {
  REQUIREMENT_MAX_QUANTITY,
  REQUIREMENT_NOTES_MAX,
  REQUIREMENT_TITLE_MAX,
  todayInRentalZone,
} from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formErrorsFromApi, type FieldErrors } from '../../../features/auth';
import { PreviewBanner, useCreateRequirementAction } from '../../../features/progress';
import { useCategories, useCities } from '../../../features/rental';
import {
  emptyRequirementForm,
  validateRequirementForm,
  type RequirementFormValues,
} from '../../../features/requirements';
import { useTheme } from '../../../features/theme';
import {
  Button,
  ErrorMessage,
  Heading,
  Screen,
  Select,
  TextField,
  useIsWide,
} from '../../../features/ui';

export default function NewRequirementScreen() {
  const theme = useTheme();
  const wide = useIsWide();
  const router = useRouter();
  const create = useCreateRequirementAction();
  const { cities, isLoading: citiesLoading } = useCities();
  const { categories, isLoading: categoriesLoading } = useCategories();

  const [values, setValues] = useState<RequirementFormValues>(() =>
    emptyRequirementForm(todayInRentalZone()),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  const set = (patch: Partial<RequirementFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const row = { flexDirection: wide ? 'row' : 'column', gap: theme.spacing.sm } as const;
  const column = { flex: wide ? 1 : undefined };

  const submit = () => {
    const result = validateRequirementForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(undefined);
    const cityName = cities.find((c) => c.geoId === result.value.cityGeoId)?.name ?? '';
    create.mutate(
      { body: result.value, cityName },
      {
        onSuccess: (created) =>
          router.replace({ pathname: '/requirements/[id]', params: { id: created.id } }),
        onError: (error) => {
          const { fields, form } = formErrorsFromApi(error);
          setErrors(fields);
          setFormError(form);
        },
      },
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Post a requirement' }} />
      <PreviewBanner />
      <Heading
        title="Post a requirement"
        subtitle="Saved as a draft. Next you pick which suppliers to send it to."
      />
      <TextField
        label="Title"
        value={values.title}
        onChangeText={(title) => set({ title })}
        maxLength={REQUIREMENT_TITLE_MAX}
        placeholder="Excavator for foundation work"
        error={errors.title}
      />
      <View style={row}>
        <View style={column}>
          <Select
            label="Category"
            value={values.categoryCode}
            placeholder="Choose a category"
            loading={categoriesLoading}
            options={categories.map((c) => ({ value: c.code, label: c.displayName }))}
            onChange={(categoryCode) => set({ categoryCode })}
            error={errors.categoryCode}
          />
        </View>
        <View style={column}>
          <Select
            label="Site city"
            value={values.cityGeoId}
            placeholder="Choose a city"
            loading={citiesLoading}
            options={cities.map((c) => ({ value: c.geoId, label: c.name, description: c.state }))}
            onChange={(cityGeoId) => set({ cityGeoId })}
            error={errors.cityGeoId}
          />
        </View>
      </View>
      <View style={row}>
        <View style={column}>
          <TextField
            label="Start date"
            value={values.startDate}
            onChangeText={(startDate) => set({ startDate })}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            error={errors.startDate}
          />
        </View>
        <View style={column}>
          <TextField
            label="End date"
            value={values.endDate}
            onChangeText={(endDate) => set({ endDate })}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            error={errors.endDate}
          />
        </View>
      </View>
      <View style={row}>
        <View style={column}>
          <TextField
            label={`Machines needed (1–${REQUIREMENT_MAX_QUANTITY})`}
            value={values.quantity}
            onChangeText={(quantity) => set({ quantity })}
            keyboardType="number-pad"
            error={errors.quantity}
          />
        </View>
        <View style={column}>
          <TextField
            label="Budget per day, ₹ (optional)"
            value={values.budgetPerDay}
            onChangeText={(budgetPerDay) => set({ budgetPerDay })}
            keyboardType="decimal-pad"
            placeholder="12000"
            error={errors.budgetPerDay}
          />
        </View>
      </View>
      <TextField
        label="Notes for suppliers (optional)"
        value={values.notes}
        onChangeText={(notes) => set({ notes })}
        maxLength={REQUIREMENT_NOTES_MAX}
        multiline
        placeholder="Site access, operator needs, working hours…"
        error={errors.notes}
      />
      <ErrorMessage message={formError} />
      <Button title="Save requirement" loading={create.isPending} onPress={submit} />
    </Screen>
  );
}
