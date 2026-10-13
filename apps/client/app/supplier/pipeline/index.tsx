import type { RentalRequestStatus } from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useIncomingRentalRequests } from '../../../api';
import { useSession } from '../../../features/auth';
import { formatRupees, ListingThumb } from '../../../features/rental';
import {
  Card,
  CardTitle,
  formatDateRange,
  Muted,
  QuoteStatusBadge,
  RequestStatusBadge,
  supplierErrorMessage,
} from '../../../features/supplier';
import { requestStage, StageBar } from '../../../features/progress';
import { useTheme } from '../../../features/theme';
import {
  Button,
  Chips,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Pagination,
  Screen,
} from '../../../features/ui';

const PAGE_SIZE = 20;

type StatusFilter = RentalRequestStatus | 'ALL';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Declined' },
  { value: 'ALL', label: 'All' },
];

export default function IncomingRequestsScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [page, setPage] = useState(1);
  const requests = useIncomingRentalRequests(api, {
    status: status === 'ALL' ? undefined : status,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Rental requests' }} />
      <Heading title="Rental requests" subtitle="Requests from builders for your listings." />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          title="Open the pipeline"
          variant="secondary"
          onPress={() => router.push('/supplier/pipeline/tracker')}
        />
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
      <ErrorMessage message={supplierErrorMessage(requests.error)} />
      {requests.isLoading ? (
        <LoadingIndicator />
      ) : requests.data && requests.data.items.length > 0 ? (
        <>
          <View style={{ gap: theme.spacing.sm }}>
            {requests.data.items.map((request) => (
              <Card
                key={request.id}
                label={`Request from ${request.builderName}`}
                onPress={() =>
                  router.push({
                    pathname: '/supplier/pipeline/requests/[id]',
                    params: { id: request.id },
                  })
                }
              >
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <ListingThumb listing={request.listing} authenticated />
                  <View style={{ flex: 1, gap: theme.spacing.xs }}>
                    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                      <CardTitle>{request.builderName}</CardTitle>
                      {request.viewedAt === null && request.status === 'PENDING' ? (
                        <Muted>• New</Muted>
                      ) : null}
                    </View>
                    <Muted>
                      {request.listing.title} ·{' '}
                      {formatDateRange(request.startDate, request.endDate)} ({request.days}{' '}
                      {request.days === 1 ? 'day' : 'days'})
                    </Muted>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <RequestStatusBadge status={request.status} />
                  {request.requirementId ? <Muted>From a requirement</Muted> : null}
                  {request.latestQuote ? (
                    <>
                      <QuoteStatusBadge status={request.latestQuote.status} />
                      <Muted>{formatRupees(request.latestQuote.total)}</Muted>
                    </>
                  ) : null}
                </View>
                <StageBar state={requestStage(request)} compact />
              </Card>
            ))}
          </View>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={requests.data.total}
            onChange={setPage}
          />
        </>
      ) : requests.data ? (
        <EmptyState
          title={status === 'PENDING' ? 'No new requests' : 'No requests with this status'}
          message="Requests appear here when builders ask to rent one of your listings."
        />
      ) : null}
    </Screen>
  );
}
