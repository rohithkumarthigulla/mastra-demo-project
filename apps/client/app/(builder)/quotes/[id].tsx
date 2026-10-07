import { todayInRentalZone } from '@ee/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError } from '../../../api';
import { formErrorsFromApi } from '../../../features/auth';
import {
  Field,
  formatDate,
  formatDateRange,
  QuoteStatusBadge,
  useAcceptQuoteAction,
  useQuoteDetail,
  useRejectQuoteAction,
} from '../../../features/progress';
import { QuoteBreakdown } from '../../../features/quotes';
import { useTheme } from '../../../features/theme';
import {
  Button,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
  TextField,
} from '../../../features/ui';

const REASON_MAX = 500;

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const quote = useQuoteDetail(id);
  const accept = useAcceptQuoteAction();
  const reject = useRejectQuoteAction();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  if (quote.isLoading) return <LoadingIndicator />;
  if (!quote.data) {
    const notFound = quote.error instanceof ApiError && quote.error.status === 404;
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Quote' }} />
        <ErrorMessage
          message={notFound ? 'This quote doesn’t exist.' : formErrorsFromApi(quote.error).form}
        />
      </Screen>
    );
  }

  const item = quote.data;
  const lapsed = item.validUntil !== null && item.validUntil < todayInRentalZone();
  const open = item.status === 'SENT' && !lapsed;
  const actionError = accept.error ?? reject.error;
  const busy = accept.isPending || reject.isPending;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Quote' }} />
      <Heading title={item.listing.title} subtitle={`Quote from ${item.supplierName}`} />
      <QuoteStatusBadge status={lapsed && item.status === 'SENT' ? 'EXPIRED' : item.status} />

      <View style={{ gap: theme.spacing.xs }}>
        <Field
          label="Dates"
          value={formatDateRange(
            item.rentalRequest.startDate,
            item.rentalRequest.endDate,
            item.rentalRequest.days,
          )}
        />
        {item.validUntil ? (
          <Field
            label={lapsed ? 'Expired on' : 'Valid until'}
            value={formatDate(item.validUntil)}
          />
        ) : null}
        {item.notes ? <Field label="Supplier notes" value={item.notes} /> : null}
      </View>

      <QuoteBreakdown quote={item} />

      {item.bookingId ? (
        <Button
          title="View booking"
          onPress={() =>
            router.push({ pathname: '/bookings/[id]', params: { id: item.bookingId! } })
          }
        />
      ) : null}

      {open ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
            Accepting books the machine for these dates. If this request came from a requirement,
            the other suppliers’ requests are closed.
          </Text>
          <ErrorMessage message={actionError ? formErrorsFromApi(actionError).form : null} />
          {declining ? (
            <>
              <TextField
                label="Reason (optional)"
                value={reason}
                onChangeText={setReason}
                maxLength={REASON_MAX}
                multiline
                placeholder="Too expensive, dates changed…"
              />
              <Button
                title="Decline quote"
                variant="secondary"
                loading={reject.isPending}
                disabled={busy}
                onPress={() =>
                  reject.mutate(
                    { quoteId: item.id, reason: reason.trim() || undefined },
                    { onSuccess: () => setDeclining(false) },
                  )
                }
              />
              <Button
                title="Keep quote"
                variant="secondary"
                disabled={busy}
                onPress={() => setDeclining(false)}
              />
            </>
          ) : (
            <>
              <Button
                title="Accept and book"
                loading={accept.isPending}
                disabled={busy}
                onPress={() =>
                  accept.mutate(item.id, {
                    onSuccess: (accepted) => {
                      if (accepted.bookingId) {
                        router.replace({
                          pathname: '/bookings/[id]',
                          params: { id: accepted.bookingId },
                        });
                      }
                    },
                  })
                }
              />
              <Button
                title="Decline"
                variant="secondary"
                disabled={busy}
                onPress={() => setDeclining(true)}
              />
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
