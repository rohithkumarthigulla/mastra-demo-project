import type { EquipmentListingDto } from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError } from '../../../../api';
import { formErrorsFromApi, useSession } from '../../../../features/auth';
import { formatDailyRate, ListingStatusBadge, queryKeys } from '../../../../features/rental';
import {
  changedFields,
  ListingEditor,
  ListingMachines,
  listingToForm,
  PhotoManager,
  RateCardEditor,
  SectionTitle,
  useRefreshListings,
  validateListingForm,
} from '../../../../features/supplier';
import { useTheme } from '../../../../features/theme';
import {
  Button,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
  useIsWide,
} from '../../../../features/ui';

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const theme = useTheme();
  const wide = useIsWide();
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = useRefreshListings();
  const [saved, setSaved] = useState(false);

  const listing = useQuery({
    queryKey: queryKeys.supplierListing(id),
    queryFn: () => api.supplierListings.get(id),
  });

  const applied = (updated: EquipmentListingDto) => {
    // Show the new state straight away, then refresh every list that includes it.
    queryClient.setQueryData(queryKeys.supplierListing(id), updated);
    void refresh();
  };

  const update = useMutation({
    mutationFn: (body: Parameters<typeof api.supplierListings.update>[1]) =>
      api.supplierListings.update(id, body),
    onMutate: () => setSaved(false),
    onSuccess: (updated) => {
      applied(updated);
      setSaved(true);
    },
  });
  const transition = useMutation({
    mutationFn: (action: 'publish' | 'deactivate') =>
      action === 'publish' ? api.supplierListings.publish(id) : api.supplierListings.deactivate(id),
    onSuccess: applied,
  });

  if (listing.isLoading) return <LoadingIndicator />;
  if (!listing.data) {
    const notFound = listing.error instanceof ApiError && listing.error.status === 404;
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Listing' }} />
        <ErrorMessage
          message={
            notFound ? 'This listing no longer exists.' : formErrorsFromApi(listing.error).form
          }
        />
        <Button
          title="Back to my listings"
          variant="secondary"
          onPress={() => router.replace('/supplier/fleet/listings')}
        />
      </Screen>
    );
  }

  const current = listing.data;
  const updateErrors = update.error ? formErrorsFromApi(update.error) : { fields: {} };
  // The API's message (e.g. why a listing can't be published) is meant for the supplier.
  const transitionError =
    transition.error instanceof ApiError
      ? transition.error.message
      : transition.error
        ? formErrorsFromApi(transition.error).form
        : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: current.title }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        <ListingStatusBadge status={current.status} />
        <Text style={{ color: theme.colors.textMuted }}>
          {formatDailyRate(current.pricePerDay)}
        </Text>
      </View>
      <Heading
        title={current.title}
        subtitle={`${current.model.manufacturer.name} ${current.model.modelName} · ${current.city.name}`}
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        {current.status === 'ACTIVE' ? (
          <Button
            title="Deactivate"
            variant="secondary"
            loading={transition.isPending}
            onPress={() => transition.mutate('deactivate')}
          />
        ) : (
          <Button
            title="Publish"
            loading={transition.isPending}
            onPress={() => transition.mutate('publish')}
          />
        )}
        {current.status === 'ACTIVE' ? (
          <Button
            title="View public page"
            variant="secondary"
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: current.id } })}
          />
        ) : null}
      </View>
      <ErrorMessage message={transitionError} />
      {transition.error instanceof ApiError &&
      transition.error.code === 'listing_has_no_active_units' ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            title="Add a machine"
            onPress={() =>
              router.push({ pathname: '/supplier/fleet/units/new', params: { listingId: id } })
            }
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: wide ? 'row' : 'column',
          gap: theme.spacing.xl,
          alignItems: 'flex-start',
        }}
      >
        <View
          style={{
            flex: wide ? 1 : undefined,
            width: wide ? undefined : '100%',
            gap: theme.spacing.md,
          }}
        >
          <PhotoManager listing={current} />
          <ListingMachines listingId={current.id} />
        </View>
        <View
          style={{
            flex: wide ? 1 : undefined,
            width: wide ? undefined : '100%',
            gap: theme.spacing.md,
          }}
        >
          <SectionTitle>Details</SectionTitle>
          <ListingEditor
            key={current.updatedAt}
            initial={listingToForm(current)}
            initialModelLabel={`${current.model.manufacturer.name} ${current.model.modelName}`}
            submitLabel="Save changes"
            submitting={update.isPending}
            fieldErrors={updateErrors.fields}
            formError={updateErrors.form}
            onSubmit={(value) => {
              const before = validateListingForm(listingToForm(current));
              const changes = before.ok ? changedFields(before.value, value) : value;
              if (Object.keys(changes).length === 0) {
                setSaved(true);
                return;
              }
              update.mutate(changes);
            }}
          />
          {saved ? <Text style={{ color: theme.colors.textMuted }}>Saved.</Text> : null}
          <RateCardEditor listingId={current.id} />
        </View>
      </View>
    </Screen>
  );
}
