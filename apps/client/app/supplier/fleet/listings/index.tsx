import type { ListingStatus } from '@ee/contracts';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formErrorsFromApi, useSession } from '../../../../features/auth';
import { ListingCard, LISTINGS_PAGE_SIZE, queryKeys } from '../../../../features/rental';
import { useTheme } from '../../../../features/theme';
import {
  Button,
  Chips,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Pagination,
  Screen,
} from '../../../../features/ui';

type StatusFilter = ListingStatus | 'ALL';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function SupplierListingsScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const filter = status === 'ALL' ? undefined : status;

  const listings = useQuery({
    queryKey: queryKeys.supplierListings(filter, page),
    queryFn: () =>
      api.supplierListings.list({
        status: filter,
        limit: LISTINGS_PAGE_SIZE,
        offset: (page - 1) * LISTINGS_PAGE_SIZE,
      }),
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'My listings' }} />
      <Heading
        title="My listings"
        subtitle="Draft a listing, add photos, then publish it for builders."
      />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button title="New listing" onPress={() => router.push('/supplier/fleet/listings/new')} />
      </View>
      <Chips
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
      />
      <ErrorMessage message={listings.error ? formErrorsFromApi(listings.error).form : null} />
      {listings.isLoading ? (
        <LoadingIndicator />
      ) : listings.data && listings.data.items.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {listings.data.items.map((listing) => (
              <ListingCard
                key={listing.id}
                owner
                listing={listing}
                onPress={() =>
                  router.push({
                    pathname: '/supplier/fleet/listings/[id]',
                    params: { id: listing.id },
                  })
                }
              />
            ))}
          </View>
          <Pagination
            page={page}
            pageSize={LISTINGS_PAGE_SIZE}
            total={listings.data.total}
            onChange={setPage}
          />
        </>
      ) : listings.data ? (
        <EmptyState
          title={status === 'ALL' ? 'No listings yet' : 'No listings with this status'}
          message={
            status === 'ALL'
              ? 'Create your first listing to start renting out equipment.'
              : undefined
          }
        />
      ) : null}
    </Screen>
  );
}
