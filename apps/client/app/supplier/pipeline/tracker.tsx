import { MAX_LIST_LIMIT } from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useIncomingRentalRequests, useSupplierBookings } from '../../../api';
import { useSession } from '../../../features/auth';
import { formatRupees } from '../../../features/rental';
import {
  buildBoard,
  Card,
  CardTitle,
  formatDateRange,
  Muted,
  summarise,
  supplierErrorMessage,
  TRACKER_COLUMN_LABELS,
  TRACKER_COLUMNS,
  type TrackerCard,
} from '../../../features/supplier';
import { useTheme } from '../../../features/theme';
import { ErrorMessage, Heading, LoadingIndicator, Screen, useIsWide } from '../../../features/ui';

const ROUTES = {
  request: '/supplier/pipeline/requests/[id]',
  quote: '/supplier/pipeline/quotes/[id]',
  booking: '/supplier/bookings/[id]',
} as const;

export default function TrackerScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const wide = useIsWide();
  // Every open request is PENDING; later stages are tracked through the booking.
  const requests = useIncomingRentalRequests(api, { status: 'PENDING', limit: MAX_LIST_LIMIT });
  const bookings = useSupplierBookings(api, { limit: MAX_LIST_LIMIT });

  const loading = requests.isLoading || bookings.isLoading;
  const error = supplierErrorMessage(requests.error ?? bookings.error);
  const { board, closed } = buildBoard({
    requests: requests.data?.items ?? [],
    bookings: bookings.data?.items ?? [],
  });
  const summary = summarise(board);
  const truncated =
    (requests.data?.total ?? 0) > MAX_LIST_LIMIT || (bookings.data?.total ?? 0) > MAX_LIST_LIMIT;

  const card = (item: TrackerCard) => (
    <Card
      key={`${item.kind}-${item.id}`}
      label={`${item.builderName}, ${item.title}`}
      onPress={() => router.push({ pathname: ROUTES[item.kind], params: { id: item.id } })}
    >
      <CardTitle>{item.builderName}</CardTitle>
      <Muted>{item.title}</Muted>
      <Muted>{formatDateRange(item.startDate, item.endDate)}</Muted>
      {item.amount !== null ? (
        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
          {formatRupees(item.amount)}
        </Text>
      ) : null}
    </Card>
  );

  const columns = TRACKER_COLUMNS.map((column) => (
    <View
      key={column}
      accessibilityLabel={`${TRACKER_COLUMN_LABELS[column]}, ${summary.counts[column]}`}
      style={{
        width: wide ? undefined : 260,
        flex: wide ? 1 : undefined,
        minWidth: wide ? 160 : undefined,
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
        {TRACKER_COLUMN_LABELS[column]} · {summary.counts[column]}
      </Text>
      {board[column].length > 0 ? board[column].map(card) : <Muted>Nothing here.</Muted>}
    </View>
  ));

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Pipeline' }} />
      <Heading
        title="Pipeline"
        subtitle="Every open request, quote and booking, by stage. Tap a card to open it."
      />
      <ErrorMessage message={error} />
      {loading ? (
        <LoadingIndicator />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg, flexWrap: 'wrap' }}>
            <Muted>New requests: {summary.counts.NEW_REQUESTS}</Muted>
            <Muted>Quotes to send: {summary.counts.QUOTE_TO_SEND}</Muted>
            <Muted>On rent: {summary.counts.ON_RENT}</Muted>
            <Muted>Confirmed value: {formatRupees(summary.confirmedValue)}</Muted>
            <Muted>Closed: {closed}</Muted>
          </View>
          {truncated ? (
            <Muted>Showing the latest {MAX_LIST_LIMIT} requests and bookings.</Muted>
          ) : null}
          {wide ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
              {columns}
            </View>
          ) : (
            <ScrollView horizontal contentContainerStyle={{ gap: theme.spacing.sm }}>
              {columns}
            </ScrollView>
          )}
        </>
      )}
    </Screen>
  );
}
