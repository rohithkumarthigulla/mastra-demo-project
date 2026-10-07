import type { BookingStatus } from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSupplierBookings } from '../../../api';
import { useSession } from '../../../features/auth';
import { formatRupees } from '../../../features/rental';
import {
  BookingStatusBadge,
  Card,
  CardTitle,
  formatDateRange,
  Muted,
  supplierErrorMessage,
} from '../../../features/supplier';
import { bookingStage, StageBar } from '../../../features/progress';
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

type StatusFilter = BookingStatus | 'ALL';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'ON_RENT', label: 'On rent' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function SupplierBookingsScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const bookings = useSupplierBookings(api, {
    status: status === 'ALL' ? undefined : status,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Bookings' }} />
      <Heading title="Bookings" subtitle="Accepted quotes, from dispatch to return." />
      <Chips
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
      />
      <ErrorMessage message={supplierErrorMessage(bookings.error)} />
      {bookings.isLoading ? (
        <LoadingIndicator />
      ) : bookings.data && bookings.data.items.length > 0 ? (
        <>
          <View style={{ gap: theme.spacing.sm }}>
            {bookings.data.items.map((booking) => (
              <Card
                key={booking.id}
                label={`Booking for ${booking.builderName}`}
                onPress={() =>
                  router.push({ pathname: '/supplier/bookings/[id]', params: { id: booking.id } })
                }
              >
                <CardTitle>{booking.builderName}</CardTitle>
                <Muted>
                  {booking.listing.title} · {formatDateRange(booking.startDate, booking.endDate)}
                </Muted>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
                  <BookingStatusBadge status={booking.status} />
                  <Muted>{formatRupees(booking.total)}</Muted>
                </View>
                <StageBar state={bookingStage(booking)} compact />
              </Card>
            ))}
          </View>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={bookings.data.total}
            onChange={setPage}
          />
        </>
      ) : bookings.data ? (
        <EmptyState
          title="No bookings"
          message="A booking is created when a builder accepts one of your quotes."
        />
      ) : null}
    </Screen>
  );
}
