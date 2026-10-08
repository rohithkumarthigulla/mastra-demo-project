import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { ApiError } from '../../api';
import { formErrorsFromApi, useSession } from '../../features/auth';
import { SpecList } from '../../features/equipment';
import {
  browseQuery,
  ListingCard,
  queryKeys,
  useCategories,
  useManufacturers,
} from '../../features/rental';
import { useTheme } from '../../features/theme';
import { EmptyState, ErrorMessage, Heading, LoadingIndicator, Screen } from '../../features/ui';

export default function EquipmentModelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const { byId: manufacturers } = useManufacturers();
  const { byId: categories } = useCategories();

  const model = useQuery({ queryKey: queryKeys.model(id), queryFn: () => api.knowledge.model(id) });
  const filters = { modelId: id };
  const listings = useQuery({
    queryKey: queryKeys.browse(filters, 1),
    queryFn: () => api.listings.browse(browseQuery(filters, 1, 50)),
  });

  if (model.isLoading) return <LoadingIndicator />;
  if (!model.data) {
    const notFound = model.error instanceof ApiError && model.error.status === 404;
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Equipment' }} />
        <ErrorMessage
          message={
            notFound ? 'This equipment model was not found.' : formErrorsFromApi(model.error).form
          }
        />
      </Screen>
    );
  }

  const m = model.data;
  const maker = manufacturers.get(m.manufacturerId)?.name;
  const title = [maker, m.modelName].filter(Boolean).join(' ');
  const section = {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
  } as const;

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Heading
        title={title}
        subtitle={
          [categories.get(m.categoryId)?.displayName, m.modelCode].filter(Boolean).join(' · ') ||
          undefined
        }
      />
      <Text accessibilityRole="header" style={section}>
        Specifications
      </Text>
      <SpecList specifications={m.specifications} />
      <Text accessibilityRole="header" style={section}>
        Available to rent
      </Text>
      {listings.isLoading ? (
        <View
          accessibilityLabel="Loading listings"
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
        >
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textMuted }}>Loading listings…</Text>
        </View>
      ) : null}
      <ErrorMessage message={listings.error ? formErrorsFromApi(listings.error).form : null} />
      {listings.data && listings.data.items.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {listings.data.items.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })}
            />
          ))}
        </View>
      ) : listings.data ? (
        <EmptyState
          title="No listings yet"
          message="No suppliers are listing this model right now."
        />
      ) : null}
    </Screen>
  );
}
