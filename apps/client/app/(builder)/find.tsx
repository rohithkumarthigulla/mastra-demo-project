import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { formErrorsFromApi, useSession } from '../../features/auth';
import {
  browseQuery,
  FilterBar,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  ListingCard,
  LISTINGS_PAGE_SIZE,
  queryKeys,
  type ListingFilters,
} from '../../features/rental';
import { useTheme } from '../../features/theme';
import {
  Button,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Pagination,
  Screen,
} from '../../features/ui';

export default function FindEquipmentScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const { filters, page } = filtersFromParams(useLocalSearchParams());

  // Filters live in the URL so a reload or shared link shows the same results.
  const show = (next: ListingFilters, nextPage = 1) =>
    router.replace({ pathname: '/find', params: filtersToParams(next, nextPage) });

  const listings = useQuery({
    queryKey: queryKeys.browse(filters, page),
    queryFn: () => api.listings.browse(browseQuery(filters, page)),
    placeholderData: (previous) => previous,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Find equipment' }} />
      <Heading title="Find equipment" subtitle="Machines available to rent now, newest first." />
      <FilterBar filters={filters} onChange={(next) => show(next)} />
      {hasActiveFilters(filters) ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button title="Clear filters" variant="secondary" onPress={() => show({})} />
        </View>
      ) : null}
      <ErrorMessage message={listings.error ? formErrorsFromApi(listings.error).form : null} />
      {listings.isLoading ? (
        <LoadingIndicator />
      ) : listings.data && listings.data.items.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {listings.data.items.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onPress={() =>
                  router.push({ pathname: '/listing/[id]', params: { id: listing.id } })
                }
              />
            ))}
          </View>
          <Pagination
            page={page}
            pageSize={LISTINGS_PAGE_SIZE}
            total={listings.data.total}
            onChange={(next) => show(filters, next)}
          />
        </>
      ) : listings.data ? (
        <EmptyState
          title="No equipment found"
          message={
            hasActiveFilters(filters)
              ? 'Try widening your filters.'
              : 'Check back soon — suppliers are adding machines.'
          }
        />
      ) : null}
    </Screen>
  );
}
