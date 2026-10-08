import { updateSupplierProfileRequestSchema } from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import {
  fieldErrorsFromZod,
  formErrorsFromApi,
  useSession,
  type FormErrors,
} from '../../features/auth';
import { queryKeys } from '../../features/rental';
import { useTheme } from '../../features/theme';
import {
  Button,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
  TextField,
} from '../../features/ui';

export default function SupplierCompanyScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: queryKeys.supplierProfile,
    queryFn: api.supplierProfile.get,
  });
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile.data) setDisplayName(profile.data.displayName);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: api.supplierProfile.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.supplierProfile, updated);
      // Listings embed the supplier name.
      void queryClient.invalidateQueries({ queryKey: ['supplier-listings'] });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      setSaved(true);
    },
    onError: (error) => setErrors(formErrorsFromApi(error)),
  });

  function submit() {
    setSaved(false);
    const parsed = updateSupplierProfileRequestSchema.safeParse({ displayName });
    if (!parsed.success) {
      setErrors({ fields: fieldErrorsFromZod(parsed.error) });
      return;
    }
    setErrors({ fields: {} });
    save.mutate(parsed.data);
  }

  if (profile.isLoading) {
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Company profile' }} />
        <LoadingIndicator />
      </Screen>
    );
  }
  // Never show the form without the saved name: saving a blank field would overwrite it.
  if (!profile.data) {
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Company profile' }} />
        <ErrorMessage
          message={formErrorsFromApi(profile.error).form ?? 'Could not load your company profile.'}
        />
        <Button
          title="Try again"
          variant="secondary"
          loading={profile.isFetching}
          onPress={() => void profile.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen centered>
      <Stack.Screen options={{ title: 'Company profile' }} />
      <Heading title="Company profile" subtitle="Builders see this name on your listings." />
      <ErrorMessage message={errors.form} />
      <TextField
        label="Business name"
        value={displayName}
        onChangeText={(text) => {
          setDisplayName(text);
          setSaved(false);
        }}
        autoComplete="organization"
        onSubmitEditing={submit}
        error={errors.fields.displayName}
      />
      <Button title="Save" loading={save.isPending} onPress={submit} />
      {saved ? <Text style={{ color: theme.colors.textMuted }}>Saved.</Text> : null}
    </Screen>
  );
}
