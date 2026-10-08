import { rentalRequestStatusSchema, type RentalRequestStatus } from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formErrorsFromApi } from '../../../features/auth';
import {
  Card,
  formatDateRange,
  REQUEST_STATUS,
  RequestStatusBadge,
  requestStage,
  StageBar,
  useMyRequests,
} from '../../../features/progress';
import { formatRupees } from '../../../features/rental';
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
type Filter = 'ALL' | RentalRequestStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...rentalRequestStatusSchema.options.map((status) => ({
    value: status,
    label: REQUEST_STATUS[status].label,
  })),
];

export default function MyRequestsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);

  const requests = useMyRequests({
    ...(filter === 'ALL' ? {} : { status: filter }),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'My requests' }} />
      <Heading title="My requests" subtitle="Equipment you’ve asked suppliers for" />
      <Chips
        label="Status"
        value={filter}
        options={FILTERS}
        onChange={(next) => {
          setFilter(next);
          setPage(1);
        }}
      />
      {requests.isLoading ? (
        <LoadingIndicator />
      ) : !requests.data ? (
        <ErrorMessage message={formErrorsFromApi(requests.error).form} />
      ) : requests.data.items.length === 0 ? (
        <EmptyState
          title={filter === 'ALL' ? 'No requests yet' : 'Nothing here'}
          message="Find a machine and request it for your dates."
        >
          <Button title="Find equipment" onPress={() => router.push('/find')} />
        </EmptyState>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {requests.data.items.map((request) => (
            <Card
              key={request.id}
              title={request.listing.title}
              subtitle={`${request.supplierName} · ${formatDateRange(request.startDate, request.endDate, request.days)}`}
              aside={<RequestStatusBadge status={request.status} />}
              onPress={() =>
                router.push({ pathname: '/requests/[id]', params: { id: request.id } })
              }
            >
              <StageBar state={requestStage(request)} compact />
              {request.latestQuote && requestStage(request).current !== 'requested' ? (
                <Text style={{ color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>
                  Quote: {formatRupees(request.latestQuote.total)}
                </Text>
              ) : null}
            </Card>
          ))}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={requests.data.total}
            onChange={setPage}
          />
        </View>
      )}
    </Screen>
  );
}
