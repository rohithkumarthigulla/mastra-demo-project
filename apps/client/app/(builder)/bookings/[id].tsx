import { BOOKING_CANCEL_REASON_MAX, CANCELLABLE_BOOKING_STATUSES } from '@ee/contracts';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError } from '../../../api';
import { formErrorsFromApi } from '../../../features/auth';
import {
  BookingStatusBadge,
  bookingStage,
  bookingTimeline,
  Field,
  formatDateRange,
  StageBar,
  Timeline,
  useBookingDetail,
  useCancelBookingAction,
} from '../../../features/progress';
import { formatRupees } from '../../../features/rental';
import { useTheme } from '../../../features/theme';
import {
  Button,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
  TextField,
} from '../../../features/ui';

const CANCELLABLE = new Set<string>(CANCELLABLE_BOOKING_STATUSES);

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const booking = useBookingDetail(id);
  const cancel = useCancelBookingAction();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();

  if (booking.isLoading) return <LoadingIndicator />;
  if (!booking.data) {
    const notFound = booking.error instanceof ApiError && booking.error.status === 404;
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Booking' }} />
        <ErrorMessage
          message={notFound ? 'This booking doesn’t exist.' : formErrorsFromApi(booking.error).form}
        />
      </Screen>
    );
  }

  const item = booking.data;
  const section = {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  } as const;

  const submitCancel = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Tell the supplier why you’re cancelling.');
      return;
    }
    setReasonError(undefined);
    cancel.mutate(
      { bookingId: item.id, reason: trimmed },
      {
        onSuccess: () => setCancelling(false),
        onError: (error) => setReasonError(formErrorsFromApi(error).fields.reason),
      },
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Booking' }} />
      <Heading title={item.listing.title} subtitle={`Booked from ${item.supplierName}`} />
      <BookingStatusBadge status={item.status} />
      <StageBar state={bookingStage(item)} />

      <View style={{ gap: theme.spacing.xs }}>
        <Field label="Dates" value={formatDateRange(item.startDate, item.endDate, item.days)} />
        <Field label="Total" value={formatRupees(item.total)} />
        <Field label="City" value={item.listing.city} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' }}>
        <Link
          href={{ pathname: '/listing/[id]', params: { id: item.listing.id } }}
          style={{ color: theme.colors.primary, fontWeight: '600' }}
        >
          View machine
        </Link>
        <Link
          href={{ pathname: '/quotes/[id]', params: { id: item.quoteId } }}
          style={{ color: theme.colors.primary, fontWeight: '600' }}
        >
          View quote
        </Link>
      </View>

      <Text style={section}>History</Text>
      <Timeline entries={bookingTimeline(item)} />

      {CANCELLABLE.has(item.status) ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ErrorMessage message={cancel.error ? formErrorsFromApi(cancel.error).form : null} />
          {cancelling ? (
            <>
              <TextField
                label="Reason for cancelling"
                value={reason}
                onChangeText={setReason}
                maxLength={BOOKING_CANCEL_REASON_MAX}
                multiline
                error={reasonError}
              />
              <Button title="Cancel booking" loading={cancel.isPending} onPress={submitCancel} />
              <Button
                title="Keep booking"
                variant="secondary"
                disabled={cancel.isPending}
                onPress={() => setCancelling(false)}
              />
            </>
          ) : (
            <Button
              title="Cancel booking"
              variant="secondary"
              onPress={() => setCancelling(true)}
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
