import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useCreateQuote, useRentalRequest, useSendQuote } from '../../../../api';
import { useSession } from '../../../../features/auth';
import {
  ConfirmDialog,
  formatDateRange,
  newQuoteDraft,
  QuoteBuilder,
  supplierErrorMessage,
  supplierErrors,
  toCreateQuote,
  type ParsedQuote,
} from '../../../../features/supplier';
import { ErrorMessage, Heading, LoadingIndicator, Screen } from '../../../../features/ui';

export default function NewQuoteScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { api } = useSession();
  const router = useRouter();
  const request = useRentalRequest(api, requestId);
  const create = useCreateQuote(api);
  const send = useSendQuote(api);
  const [confirming, setConfirming] = useState<ParsedQuote | null>(null);

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
        <Stack.Screen options={{ title: 'New quote' }} />
        <ErrorMessage message={supplierErrorMessage(request.error) ?? 'Request not found.'} />
      </Screen>
    );
  }

  const r = request.data;
  const openQuote = (id: string) =>
    router.replace({ pathname: '/supplier/pipeline/quotes/[id]', params: { id } });
  const apiErrors = supplierErrors(create.error ?? send.error);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'New quote' }} />
      <Heading
        title={`Quote for ${r.builderName}`}
        subtitle={`${r.listing.title} · ${formatDateRange(r.startDate, r.endDate)} (${r.days} ${r.days === 1 ? 'day' : 'days'})`}
      />
      <QuoteBuilder
        listingId={r.listing.id}
        startDate={r.startDate}
        endDate={r.endDate}
        days={r.days}
        initial={newQuoteDraft(r.days, r.listing.pricePerDay)}
        saving={create.isPending && !confirming}
        sending={false}
        serverErrors={apiErrors.fields}
        formError={confirming ? null : (apiErrors.form ?? null)}
        onSave={(quote) =>
          create.mutate(toCreateQuote(r.id, quote), { onSuccess: (q) => openQuote(q.id) })
        }
        onSend={(quote) => {
          create.reset();
          send.reset();
          setConfirming(quote);
        }}
      />
      <ConfirmDialog
        visible={confirming !== null}
        title="Send this quote?"
        message={`${r.builderName} will see it straight away. You can't change a quote once it's sent.`}
        confirmLabel="Send quote"
        loading={create.isPending || send.isPending}
        error={apiErrors.form ?? null}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          create.mutate(toCreateQuote(r.id, confirming), {
            onSuccess: (q) =>
              send.mutate(q.id, {
                onSuccess: () => {
                  setConfirming(null);
                  openQuote(q.id);
                },
                // Saved but not sent: carry on from the saved draft.
                onError: () => openQuote(q.id),
              }),
          });
        }}
      />
    </Screen>
  );
}
