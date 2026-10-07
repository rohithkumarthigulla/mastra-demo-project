import { DECLINE_REASON_MAX } from '@ee/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  useMarkRentalRequestViewed,
  useRejectRentalRequest,
  useRentalRequest,
} from '../../../../api';
import { useSession } from '../../../../features/auth';
import { formatRupees } from '../../../../features/rental';
import {
  Card,
  ConfirmDialog,
  Field,
  formatDateRange,
  Muted,
  QuoteStatusBadge,
  RequestStatusBadge,
  supplierErrorMessage,
} from '../../../../features/supplier';
import { requestStage, StageBar } from '../../../../features/progress';
import { useTheme } from '../../../../features/theme';
import { Button, ErrorMessage, Heading, LoadingIndicator, Screen } from '../../../../features/ui';

export default function RentalRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const request = useRentalRequest(api, id);
  const markViewed = useMarkRentalRequestViewed(api);
  const reject = useRejectRentalRequest(api);
  const [declining, setDeclining] = useState(false);

  const unseen = request.data?.viewedAt === null;
  const { mutate: markViewedMutate } = markViewed;
  useEffect(() => {
    if (unseen) markViewedMutate(id);
  }, [unseen, id, markViewedMutate]);

  if (request.isLoading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }
  if (!request.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Rental request' }} />
        <ErrorMessage message={supplierErrorMessage(request.error) ?? 'Request not found.'} />
      </Screen>
    );
  }

  const r = request.data;
  const quote = r.latestQuote;
  const pending = r.status === 'PENDING';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Rental request' }} />
      <Heading title={`Request from ${r.builderName}`} subtitle={r.listing.title} />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        <RequestStatusBadge status={r.status} />
        {r.requirementId ? (
          <Muted>From a requirement — other suppliers may be quoting too.</Muted>
        ) : null}
      </View>
      <StageBar state={requestStage(r)} />
      <Card>
        <Field label="Builder" value={r.builderName} />
        <Field label="Listing" value={r.listing.title} />
        <Field label="Dates" value={formatDateRange(r.startDate, r.endDate)} />
        <Field label="Days" value={String(r.days)} />
        <Field label="Listed rate" value={`${formatRupees(r.listing.pricePerDay)} / day`} />
        <Field label="Message" value={r.message ?? '—'} />
        {r.declineReason ? <Field label="Decline reason" value={r.declineReason} /> : null}
      </Card>

      {quote ? (
        <Card
          label="Open quote"
          onPress={() =>
            router.push({ pathname: '/supplier/pipeline/quotes/[id]', params: { id: quote.id } })
          }
        >
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
            <QuoteStatusBadge status={quote.status} />
            <Muted>{formatRupees(quote.total)} incl. GST</Muted>
          </View>
        </Card>
      ) : null}

      <ErrorMessage message={supplierErrorMessage(markViewed.error)} />
      {pending ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          <Button
            title={quote ? 'Open quote' : 'Create quote'}
            onPress={() =>
              quote
                ? router.push({
                    pathname: '/supplier/pipeline/quotes/[id]',
                    params: { id: quote.id },
                  })
                : router.push({
                    pathname: '/supplier/pipeline/quotes/new',
                    params: { requestId: r.id },
                  })
            }
          />
          <Button
            title="Decline"
            variant="secondary"
            onPress={() => {
              reject.reset();
              setDeclining(true);
            }}
          />
        </View>
      ) : null}

      <ConfirmDialog
        visible={declining}
        title="Decline this request?"
        message={`${r.builderName} will be told you can't take this rental.`}
        confirmLabel="Decline request"
        reason={{ label: 'Reason', maxLength: DECLINE_REASON_MAX }}
        loading={reject.isPending}
        error={supplierErrorMessage(reject.error)}
        onCancel={() => setDeclining(false)}
        onConfirm={(reason) =>
          reject.mutate(
            { requestId: r.id, body: reason ? { reason } : {} },
            { onSuccess: () => setDeclining(false) },
          )
        }
      />
    </Screen>
  );
}
