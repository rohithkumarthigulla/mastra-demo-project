import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { ApiError } from '../../api';
import { formErrorsFromApi, useSession } from '../../features/auth';
import { SpecList } from '../../features/equipment';
import { formatRupees, PhotoGallery, queryKeys } from '../../features/rental';
import { useTheme } from '../../features/theme';
import {
  Button,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
  useIsWide,
} from '../../features/ui';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, snapshot } = useSession();
  const router = useRouter();
  const theme = useTheme();
  const wide = useIsWide();

  const listing = useQuery({
    queryKey: queryKeys.listing(id),
    queryFn: () => api.listings.get(id),
  });
  const modelId = listing.data?.model.id;
  const model = useQuery({
    queryKey: queryKeys.model(modelId ?? ''),
    queryFn: () => api.knowledge.model(modelId ?? ''),
    enabled: modelId !== undefined,
  });

  if (listing.isLoading) return <LoadingIndicator />;
  if (!listing.data) {
    const notFound = listing.error instanceof ApiError && listing.error.status === 404;
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Listing' }} />
        <ErrorMessage
          message={
            notFound
              ? 'This listing is no longer available.'
              : formErrorsFromApi(listing.error).form
          }
        />
      </Screen>
    );
  }

  const item = listing.data;
  const isBuilder = snapshot.status === 'signedIn' && snapshot.role === 'BUILDER';
  const muted = { color: theme.colors.textMuted, fontSize: theme.fontSize.md } as const;

  return (
    <Screen>
      <Stack.Screen options={{ title: item.title }} />
      <View
        style={{
          flexDirection: wide ? 'row' : 'column',
          gap: theme.spacing.xl,
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: wide ? 3 : undefined, width: wide ? undefined : '100%' }}>
          <PhotoGallery photos={item.photos} title={item.title} />
        </View>
        <View
          style={{
            flex: wide ? 2 : undefined,
            width: wide ? undefined : '100%',
            gap: theme.spacing.sm,
          }}
        >
          <Heading title={item.title} />
          <Text
            style={{ color: theme.colors.primary, fontSize: theme.fontSize.xl, fontWeight: '700' }}
          >
            {formatRupees(item.pricePerDay)} <Text style={muted}>/ day</Text>
          </Text>
          <Text style={muted}>
            {item.location}, {item.city.name}
          </Text>
          <Text style={muted}>Supplied by {item.supplier.displayName}</Text>
          <Link
            href={{ pathname: '/equipment/[id]', params: { id: item.model.id } }}
            style={{ color: theme.colors.primary, fontWeight: '600' }}
          >
            {item.model.manufacturer.name} {item.model.modelName} ·{' '}
            {item.model.category.displayName}
          </Link>
          {isBuilder ? (
            <Button
              title="Request equipment"
              onPress={() =>
                router.push({ pathname: '/request/[listingId]', params: { listingId: item.id } })
              }
            />
          ) : null}
        </View>
      </View>
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.md }}>
        {item.description}
      </Text>
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '600' }}>
        Specifications
      </Text>
      {model.isLoading ? (
        <Text style={muted}>Loading specifications…</Text>
      ) : model.data ? (
        <SpecList specifications={model.data.specifications} />
      ) : (
        <ErrorMessage message={formErrorsFromApi(model.error).form} />
      )}
    </Screen>
  );
}
