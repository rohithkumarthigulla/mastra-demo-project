import { createSupplierProfileRequestSchema } from '@ee/contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '../../api';
import { fieldErrorsFromZod, formErrorsFromApi, useSession, type FormErrors } from '../auth';
import { Button, ErrorMessage, Heading, TextField } from '../ui';

export function SupplierOnboardingForm() {
  const { api, state, completeOnboarding, signOut } = useSession();
  const [displayName, setDisplayName] = useState(
    state.status === 'signedIn' ? state.account.displayName : '',
  );
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });

  const create = useMutation({
    mutationFn: api.supplierProfile.create,
    onSuccess: () => completeOnboarding(),
    onError: (error) => {
      // A profile created in another tab/device means onboarding is already done.
      if (error instanceof ApiError && error.code === 'supplier_profile_exists') {
        completeOnboarding();
        return;
      }
      setErrors(formErrorsFromApi(error));
    },
  });

  function submit() {
    const parsed = createSupplierProfileRequestSchema.safeParse({ displayName });
    if (!parsed.success) {
      setErrors({ fields: fieldErrorsFromZod(parsed.error) });
      return;
    }
    setErrors({ fields: {} });
    create.mutate(parsed.data);
  }

  return (
    <>
      <Heading
        title="Set up your supplier profile"
        subtitle="This is the business name builders will see on your listings."
      />
      <ErrorMessage message={errors.form} />
      <TextField
        label="Business name"
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="organization"
        onSubmitEditing={submit}
        error={errors.fields.displayName}
      />
      <Button title="Continue" loading={create.isPending} onPress={submit} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </>
  );
}
