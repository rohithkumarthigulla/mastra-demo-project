import type { UpdateUnitRequest } from '@ee/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from '../../../../features/auth';
import type { FieldErrors } from '../../../../features/auth/formErrors';
import {
  ConfirmDialog,
  Field,
  Muted,
  supplierErrorMessage,
  supplierErrors,
  UnitEditor,
  UnitStatusBadge,
  unitName,
  unitToForm,
  useFleetMutation,
  useRefreshListings,
  useUnit,
  validateUnitChanges,
} from '../../../../features/supplier';
import { useTheme } from '../../../../features/theme';
import { Button, ErrorMessage, Heading, LoadingIndicator, Screen } from '../../../../features/ui';

export default function EditUnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const refreshListings = useRefreshListings();
  const unit = useUnit(api, id);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const [retiring, setRetiring] = useState(false);

  const update = useFleetMutation(api, (calls, body: UpdateUnitRequest) =>
    calls.units.update(id, body),
  );
  const retire = useFleetMutation(api, (calls) => calls.units.retire(id));
  const apiErrors = update.error ? supplierErrors(update.error) : { fields: {} };

  if (unit.isLoading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }
  if (!unit.data) {
    return (
      <Screen centered>
        <ErrorMessage message={supplierErrorMessage(unit.error) ?? 'Machine not found.'} />
      </Screen>
    );
  }
  const machine = unit.data;
  const retired = machine.status === 'RETIRED';

  return (
    <Screen>
      <Stack.Screen options={{ title: unitName(machine) }} />
      <Heading
        title={unitName(machine)}
        subtitle={`${machine.model.manufacturer.name} ${machine.model.modelName}`}
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
        <UnitStatusBadge status={machine.status} />
        <Button
          title="View listing"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/supplier/fleet/listings/[id]',
              params: { id: machine.listing.id },
            })
          }
        />
      </View>
      <Field label="Listing" value={machine.listing.title} />
      {retired ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Field label="Yard" value={machine.yard.name} />
          <Field label="Model year" value={String(machine.modelYear)} />
          <Muted>Retired machines are kept for history and can no longer be edited.</Muted>
        </View>
      ) : (
        <>
          <UnitEditor
            key={machine.updatedAt}
            initial={unitToForm(machine)}
            listingLocked
            submitLabel="Save changes"
            submitting={update.isPending}
            fieldErrors={{ ...apiErrors.fields, ...errors }}
            formError={apiErrors.form}
            onSubmit={(values) => {
              setSaved(false);
              const result = validateUnitChanges(machine, values);
              setErrors(result.ok ? {} : result.errors);
              if (!result.ok) return;
              if (!result.value) {
                setSaved(true);
                return;
              }
              update.mutate(result.value, { onSuccess: () => setSaved(true) });
            }}
          />
          {saved ? <Muted>Changes saved.</Muted> : null}
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              title="Retire machine"
              variant="secondary"
              onPress={() => {
                retire.reset();
                setRetiring(true);
              }}
            />
          </View>
        </>
      )}
      <ConfirmDialog
        visible={retiring}
        title="Retire this machine?"
        message="It stops counting towards the listing's availability and cannot be quoted or booked again. This cannot be undone."
        confirmLabel="Retire"
        loading={retire.isPending}
        error={supplierErrorMessage(retire.error)}
        onCancel={() => setRetiring(false)}
        onConfirm={() =>
          retire.mutate(undefined, {
            onSuccess: () => {
              setRetiring(false);
              void refreshListings();
            },
          })
        }
      />
    </Screen>
  );
}
