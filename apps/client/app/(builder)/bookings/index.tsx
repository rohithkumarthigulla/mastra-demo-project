import { bookingStatusSchema, type BookingStatus } from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formErrorsFromApi } from '../../../features/auth';
import {
  BOOKING_STATUS,
  BookingStatusBadge,
  bookingStage,
  Card,
  formatDateRange,
  StageBar,
  useMyBookings,
} from '../../../features/progress';
import { formatRupees } from '../../../features/rental';
import { useTheme } from '../../../features/theme';
import {
  Chips,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Pagination,
  Screen,
} from '../../../features/ui';

const PAGE_SIZE = 20;
type Filter = 'ALL' | BookingStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...bookingStatusSchema.options.map((status) => ({
    value: status,
    label: BOOKING_STATUS[status].label,
  })),
];

export default function MyBookingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);

  const bookings = useMyBookings({
    ...(filter === 'ALL' ? {} : { status: filter }),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Bookings' }} />
      <Heading title="Bookings" subtitle="Machines booked from accepted quotes" />
      <Chips
        label="Status"
        value={filter}
        options={FILTERS}
        onChange={(next) => {
          setFilter(next);
          setPage(1);
        }}
      />
      {bookings.isLoading ? (
        <LoadingIndicator />
      ) : !bookings.data ? (
        <ErrorMessage message={formErrorsFromApi(bookings.error).form} />
      ) : bookings.data.items.length === 0 ? (
        <EmptyState
          title="No bookings"
          message="Accept a supplier’s quote and the booking shows up here."
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {bookings.data.items.map((booking) => (
            <Card
              key={booking.id}
              title={booking.listing.title}
              subtitle={`${booking.supplierName} · ${formatDateRange(booking.startDate, booking.endDate, booking.days)}`}
              aside={<BookingStatusBadge status={booking.status} />}
              onPress={() =>
                router.push({ pathname: '/bookings/[id]', params: { id: booking.id } })
              }
            >
              <StageBar state={bookingStage(booking)} compact />
              <Text style={{ color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>
                {formatRupees(booking.total)}
              </Text>
            </Card>
          ))}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={bookings.data.total}
            onChange={setPage}
          />
        </View>
      )}
    </Screen>
  );
}
