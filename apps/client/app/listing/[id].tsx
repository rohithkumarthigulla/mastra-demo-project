import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
          <PhotoGallery
            photos={item.photos}
            title={item.title}
            categoryCode={item.model.category.code}
          />
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
            style={{
              color: theme.colors.link,
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.bold,
            }}
          >
            {formatRupees(item.pricePerDay)} <Text style={muted}>/ day</Text>
          </Text>
          <Text style={muted}>
            {item.location}, {item.city.name}
          </Text>
          <Text style={muted}>Supplied by {item.supplier.displayName}</Text>
          <Link href={{ pathname: '/equipment/[id]', params: { id: item.model.id } }} asChild>
            <Pressable
              accessibilityRole="link"
              style={{ minHeight: theme.size.touch, justifyContent: 'center' }}
            >
              <Text style={{ color: theme.colors.link, fontWeight: theme.fontWeight.semibold }}>
                {item.model.manufacturer.name} {item.model.modelName} ·{' '}
                {item.model.category.displayName}
              </Text>
            </Pressable>
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
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSize.lg,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        Specifications
      </Text>
      {model.isLoading ? (
        <View
          accessibilityLabel="Loading specifications"
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
        >
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={muted}>Loading specifications…</Text>
        </View>
      ) : model.data ? (
        <SpecList specifications={model.data.specifications} />
      ) : (
        <ErrorMessage message={formErrorsFromApi(model.error).form} />
      )}
    </Screen>
  );
}
