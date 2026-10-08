import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuote, useSendQuote, useUpdateQuote } from '../../../../api';
import { useSession } from '../../../../features/auth';
import { formatRupees } from '../../../../features/rental';
import {
  Card,
  ConfirmDialog,
  Field,
  formatDate,
  formatDateRange,
  istDate,
  LINE_TYPE_LABELS,
  Muted,
  QuoteBuilder,
  quoteToDraft,
  QuoteStatusBadge,
  SectionTitle,
  supplierErrorMessage,
  supplierErrors,
  type ParsedQuote,
} from '../../../../features/supplier';
import { useTheme } from '../../../../features/theme';
import { Button, ErrorMessage, Heading, LoadingIndicator, Screen } from '../../../../features/ui';

const EDITABLE = new Set(['DRAFT', 'PENDING_APPROVAL']);

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const quote = useQuote(api, id);
  const update = useUpdateQuote(api);
  const send = useSendQuote(api);
  const [confirming, setConfirming] = useState<ParsedQuote | null>(null);
  const [saved, setSaved] = useState(false);

  if (quote.isLoading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }
  if (!quote.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Quote' }} />
        <ErrorMessage message={supplierErrorMessage(quote.error) ?? 'Quote not found.'} />
      </Screen>
    );
  }

  const q = quote.data;
  const r = q.rentalRequest;
  const editable = EDITABLE.has(q.status);
  const apiErrors = supplierErrors(update.error ?? send.error);

  const header = (
    <>
      <Heading
        title={`Quote for ${q.builderName}`}
        subtitle={`${q.listing.title} · ${formatDateRange(r.startDate, r.endDate)} (${r.days} ${r.days === 1 ? 'day' : 'days'})`}
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        <QuoteStatusBadge status={q.status} />
        <Button
          title="View request"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/supplier/pipeline/requests/[id]', params: { id: r.id } })
          }
        />
        {q.bookingId ? (
          <Button
            title="View booking"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/supplier/bookings/[id]', params: { id: q.bookingId! } })
            }
          />
        ) : null}
      </View>
    </>
  );

  if (!editable) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Quote' }} />
        {header}
        <Card>
          <SectionTitle>Lines</SectionTitle>
          {[...q.lines]
            .sort((a, b) => a.position - b.position)
            .map((line) => (
              <Field
                key={line.id}
                label={LINE_TYPE_LABELS[line.type]}
                value={`${line.description} — ${line.quantity} × ${formatRupees(line.unitAmount)} = ${formatRupees(line.amount)}`}
              />
            ))}
        </Card>
        <Card>
          <Field label="Subtotal" value={formatRupees(q.subtotal)} />
          <Field label={`GST ${q.taxPercent}%`} value={formatRupees(q.taxAmount)} />
          <Field label="Deposit" value={formatRupees(q.depositAmount)} />
          <Field
            label="Total"
            value={
              <Text style={{ color: theme.colors.text, fontWeight: theme.fontWeight.bold }}>
                {formatRupees(q.total)}
              </Text>
            }
          />
          {q.notes ? <Field label="Notes" value={q.notes} /> : null}
          {q.validUntil ? <Field label="Valid until" value={formatDate(q.validUntil)} /> : null}
          {q.sentAt ? <Field label="Sent" value={formatDate(istDate(q.sentAt))} /> : null}
        </Card>
        <Muted>Sent quotes can&apos;t be changed.</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Quote' }} />
      {header}
      {q.status === 'PENDING_APPROVAL' || q.autoDrafted ? (
        <Card>
          <Text style={{ color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>
            Awaiting your approval
          </Text>
          <Muted>
            This quote was drafted for you. The builder can&apos;t see it until you check it and
            send it.
          </Muted>
        </Card>
      ) : null}
      <QuoteBuilder
        key={q.updatedAt}
        listingId={q.listing.id}
        startDate={r.startDate}
        endDate={r.endDate}
        days={r.days}
        initial={quoteToDraft(q)}
        saving={update.isPending && !confirming}
        sending={false}
        serverErrors={apiErrors.fields}
        formError={confirming ? null : (apiErrors.form ?? null)}
        onSave={(body) => {
          setSaved(false);
          update.mutate({ quoteId: q.id, body }, { onSuccess: () => setSaved(true) });
        }}
        onSend={(body) => {
          update.reset();
          send.reset();
          setSaved(false);
          setConfirming(body);
        }}
      />
      {saved ? <Muted>Draft saved. Saved total {formatRupees(q.total)} incl. GST.</Muted> : null}
      <ConfirmDialog
        visible={confirming !== null}
        title="Send this quote?"
        message={`${q.builderName} will see it straight away. You can't change a quote once it's sent.`}
        confirmLabel="Send quote"
        loading={update.isPending || send.isPending}
        error={apiErrors.form ?? null}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          update.mutate(
            { quoteId: q.id, body: confirming },
            {
              onSuccess: () => send.mutate(q.id, { onSuccess: () => setConfirming(null) }),
            },
          );
        }}
      />
    </Screen>
  );
}
