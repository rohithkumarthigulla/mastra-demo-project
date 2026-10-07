import { RENTAL_REQUEST_MESSAGE_MAX, todayInRentalZone } from '@ee/contracts';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formErrorsFromApi, useSession, type FieldErrors } from '../../../features/auth';
import { Field, formatDateRange, useCreateRequest } from '../../../features/progress';
import {
  estimateRental,
  formatDailyRate,
  formatRupees,
  queryKeys,
  useListingAvailability,
  validateRentalDates,
} from '../../../features/rental';
import { useTheme } from '../../../features/theme';
import {
  Button,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
  TextField,
} from '../../../features/ui';

export default function RequestListingScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const create = useCreateRequest();

  const today = todayInRentalZone();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  const listing = useQuery({
    queryKey: queryKeys.listing(listingId),
    queryFn: () => api.listings.get(listingId),
  });

  const dateErrors = validateRentalDates(startDate, endDate, today);
  const datesValid = !dateErrors.startDate && !dateErrors.endDate;
  const availability = useListingAvailability(
    api,
    listingId,
    datesValid ? { startDate, endDate } : null,
  );

  if (listing.isLoading) return <LoadingIndicator />;
  if (!listing.data) {
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Request equipment' }} />
        <ErrorMessage message={formErrorsFromApi(listing.error).form} />
      </Screen>
    );
  }

  const item = listing.data;
  const estimate = datesValid ? estimateRental(item.pricePerDay, startDate, endDate) : null;
  const soldOut = availability.data?.availableUnits === 0;

  const submit = () => {
    const fields: FieldErrors = { ...dateErrors };
    if (message.length > RENTAL_REQUEST_MESSAGE_MAX) {
      fields.message = `Keep the message under ${RENTAL_REQUEST_MESSAGE_MAX} characters.`;
    }
    setErrors(fields);
    setFormError(undefined);
    if (Object.keys(fields).length > 0) return;

    create.mutate(
      {
        listingId,
        startDate,
        endDate,
        ...(message.trim() ? { message: message.trim() } : {}),
      },
      {
        onSuccess: (request) =>
          router.replace({ pathname: '/requests/[id]', params: { id: request.id } }),
        onError: (error) => {
          const result = formErrorsFromApi(error);
          setErrors(result.fields);
          setFormError(result.form);
        },
      },
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Request equipment' }} />
      <Heading
        title={item.title}
        subtitle={`${formatDailyRate(item.pricePerDay)} · ${item.city.name}`}
      />
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.md }}>
        Supplied by {item.supplier.displayName}. They’ll reply with a quote you can accept or
        decline.
      </Text>
      <TextField
        label="Start date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
        autoCapitalize="none"
        error={errors.startDate}
      />
      <TextField
        label="End date (YYYY-MM-DD)"
        value={endDate}
        onChangeText={setEndDate}
        autoCapitalize="none"
        error={errors.endDate}
      />
      {datesValid ? (
        <Text
          style={{ color: soldOut ? theme.colors.danger : theme.colors.textMuted }}
          accessibilityLiveRegion="polite"
        >
          {availability.isLoading
            ? 'Checking availability…'
            : availability.data
              ? soldOut
                ? 'No units free on these dates — the supplier may still be able to help.'
                : `${availability.data.availableUnits} of ${availability.data.totalUnits} units free on these dates.`
              : 'Couldn’t check availability right now.'}
        </Text>
      ) : null}
      <TextField
        label="Message to the supplier (optional)"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        maxLength={RENTAL_REQUEST_MESSAGE_MAX}
        placeholder="Site address, working hours, operator needed…"
        error={errors.message}
      />
      {estimate ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Field label="Dates" value={formatDateRange(startDate, endDate, estimate.days)} />
          <Field label="Rental" value={formatRupees(estimate.subtotal)} />
          <Field label="GST" value={formatRupees(estimate.tax)} />
          <Field label="Estimate" value={formatRupees(estimate.total)} />
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
            At the listed rate. The quote may add transport, an operator or a deposit.
          </Text>
        </View>
      ) : null}
      <ErrorMessage message={formError} />
      <Button title="Send request" onPress={submit} loading={create.isPending} />
    </Screen>
  );
}
