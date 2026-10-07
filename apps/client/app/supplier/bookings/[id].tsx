import { BOOKING_CANCEL_REASON_MAX } from '@ee/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  useBooking,
  useCancelBooking,
  useCompleteBooking,
  useDispatchBooking,
  useStartRent,
} from '../../../api';
import { useSession } from '../../../features/auth';
import { formatRupees } from '../../../features/rental';
import {
  BookingStatusBadge,
  canCancelBooking,
  Card,
  ConfirmDialog,
  Field,
  formatDate,
  formatDateRange,
  istDate,
  nextBookingStep,
  supplierErrorMessage,
  useRefreshFleet,
} from '../../../features/supplier';
import { useTheme } from '../../../features/theme';
import { Button, ErrorMessage, Heading, LoadingIndicator, Screen } from '../../../features/ui';

const when = (instant: string | null) => (instant ? formatDate(istDate(instant)) : null);

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const booking = useBooking(api, id);
  const refreshFleet = useRefreshFleet();
  const mutations = {
    dispatch: useDispatchBooking(api),
    startRent: useStartRent(api),
    complete: useCompleteBooking(api),
  };
  const cancel = useCancelBooking(api);
  const [dialog, setDialog] = useState<'step' | 'cancel' | null>(null);

  if (booking.isLoading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }
  if (!booking.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Booking' }} />
        <ErrorMessage message={supplierErrorMessage(booking.error) ?? 'Booking not found.'} />
      </Screen>
    );
  }

  const b = booking.data;
  const step = nextBookingStep(b.status);
  const stepMutation = step ? mutations[step.action] : null;
  const cancellable = canCancelBooking(b.status);
  // Booking changes free or occupy the machine, so the availability calendar is stale too.
  const done = () => {
    setDialog(null);
    void refreshFleet();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Booking' }} />
      <Heading title={`Booking for ${b.builderName}`} subtitle={b.listing.title} />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        <BookingStatusBadge status={b.status} />
        <Button
          title="View quote"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/supplier/pipeline/quotes/[id]', params: { id: b.quoteId } })
          }
        />
        <Button
          title="View machine"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/supplier/fleet/units/[id]',
              params: { id: b.equipmentUnitId },
            })
          }
        />
      </View>
      <Card>
        <Field label="Builder" value={b.builderName} />
        <Field label="Listing" value={b.listing.title} />
        <Field label="Dates" value={formatDateRange(b.startDate, b.endDate)} />
        <Field label="Days" value={String(b.days)} />
        <Field label="Total" value={formatRupees(b.total)} />
        {b.dispatchedAt ? <Field label="Dispatched" value={when(b.dispatchedAt)} /> : null}
        {b.rentStartedAt ? <Field label="Rent started" value={when(b.rentStartedAt)} /> : null}
        {b.returnedAt ? <Field label="Returned" value={when(b.returnedAt)} /> : null}
        {b.cancelledAt ? <Field label="Cancelled" value={when(b.cancelledAt)} /> : null}
        {b.cancelReason ? <Field label="Cancel reason" value={b.cancelReason} /> : null}
      </Card>

      {step || cancellable ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {step && stepMutation ? (
            <Button
              title={step.title}
              onPress={() => {
                stepMutation.reset();
                setDialog('step');
              }}
            />
          ) : null}
          {cancellable ? (
            <Button
              title="Cancel booking"
              variant="secondary"
              onPress={() => {
                cancel.reset();
                setDialog('cancel');
              }}
            />
          ) : null}
        </View>
      ) : null}

      {step && stepMutation ? (
        <ConfirmDialog
          visible={dialog === 'step'}
          title={`${step.title}?`}
          message={step.confirm}
          confirmLabel={step.title}
          loading={stepMutation.isPending}
          error={supplierErrorMessage(stepMutation.error)}
          onCancel={() => setDialog(null)}
          onConfirm={() => stepMutation.mutate(b.id, { onSuccess: done })}
        />
      ) : null}
      <ConfirmDialog
        visible={dialog === 'cancel'}
        title="Cancel this booking?"
        message={`${b.builderName} will be told the booking is off and the machine is freed for these dates.`}
        confirmLabel="Cancel booking"
        reason={{ label: 'Reason', required: true, maxLength: BOOKING_CANCEL_REASON_MAX }}
        loading={cancel.isPending}
        error={supplierErrorMessage(cancel.error)}
        onCancel={() => setDialog(null)}
        onConfirm={(reason) =>
          cancel.mutate({ bookingId: b.id, body: { reason } }, { onSuccess: done })
        }
      />
    </Screen>
  );
}
