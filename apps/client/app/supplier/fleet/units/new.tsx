import type { CreateUnitRequest } from '@ee/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSession } from '../../../../features/auth';
import type { FieldErrors } from '../../../../features/auth/formErrors';
import {
  emptyUnitForm,
  supplierErrors,
  UnitEditor,
  useFleetMutation,
  useRefreshListings,
  validateNewUnit,
} from '../../../../features/supplier';
import { Heading, Screen } from '../../../../features/ui';

export default function NewUnitScreen() {
  const { api } = useSession();
  const router = useRouter();
  const { listingId } = useLocalSearchParams<{ listingId?: string }>();
  const refreshListings = useRefreshListings();
  const [errors, setErrors] = useState<FieldErrors>({});

  const create = useFleetMutation(api, (calls, body: CreateUnitRequest) =>
    calls.units.create(body),
  );
  const apiErrors = create.error ? supplierErrors(create.error) : { fields: {} };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Add a machine' }} />
      <Heading
        title="Add a machine"
        subtitle="Each physical machine you rent out under a listing, kept at one of your yards."
      />
      <UnitEditor
        initial={emptyUnitForm(listingId)}
        submitLabel="Add machine"
        submitting={create.isPending}
        fieldErrors={{ ...apiErrors.fields, ...errors }}
        formError={apiErrors.form}
        onSubmit={(values) => {
          const result = validateNewUnit(values);
          setErrors(result.ok ? {} : result.errors);
          if (!result.ok) return;
          create.mutate(result.value, {
            onSuccess: () => {
              void refreshListings();
              router.back();
            },
          });
        }}
      />
    </Screen>
  );
}
