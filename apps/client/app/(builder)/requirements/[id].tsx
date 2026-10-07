import {
  RENTAL_REQUEST_MESSAGE_MAX,
  REQUIREMENT_MAX_SUPPLIERS,
  type SendRequirementResponse,
  type SendSkipReason,
} from '@ee/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError } from '../../../api';
import { formErrorsFromApi } from '../../../features/auth';
import {
  Card,
  Field,
  formatDateRange,
  formatDateTime,
  PreviewBanner,
  QuoteStatusBadge,
  RequestStatusBadge,
  RequirementStatusBadge,
  useCancelRequirementAction,
  useMatches,
  useRequirementDetail,
  useSendRequirementAction,
} from '../../../features/progress';
import { formatDailyRate, formatRupees, useCategories } from '../../../features/rental';
import { useTheme } from '../../../features/theme';
import {
  Button,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
  TextField,
} from '../../../features/ui';

const SKIP_REASON: Record<SendSkipReason, string> = {
  ALREADY_INVITED: 'already invited',
  NOT_ACTIVE: 'listing no longer active',
  UNAVAILABLE: 'no machine free on your dates',
};

export default function RequirementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const requirement = useRequirementDetail(id);
  const { categories } = useCategories();
  const sendable = requirement.data?.status === 'DRAFT' || requirement.data?.status === 'OPEN';
  const matches = useMatches(id, { limit: REQUIREMENT_MAX_SUPPLIERS }, sendable);
  const send = useSendRequirementAction();
  const cancel = useCancelRequirementAction();

  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<SendRequirementResponse>();

  if (requirement.isLoading) return <LoadingIndicator />;
  if (!requirement.data) {
    const notFound = requirement.error instanceof ApiError && requirement.error.status === 404;
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Requirement' }} />
        <ErrorMessage
          message={
            notFound ? 'This requirement doesn’t exist.' : formErrorsFromApi(requirement.error).form
          }
        />
      </Screen>
    );
  }

  const item = requirement.data;
  const category =
    categories.find((c) => c.code === item.categoryCode)?.displayName ?? item.categoryCode;
  const room = REQUIREMENT_MAX_SUPPLIERS - item.invitationCount;
  const section = {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  } as const;
  const muted = { color: theme.colors.textMuted, fontSize: theme.fontSize.sm } as const;

  const toggle = (listingId: string) =>
    setSelected((current) =>
      current.includes(listingId)
        ? current.filter((x) => x !== listingId)
        : current.length < room
          ? [...current, listingId]
          : current,
    );

  const submitSend = () =>
    send.mutate(
      {
        requirementId: item.id,
        body: { listingIds: selected, ...(message.trim() ? { message: message.trim() } : {}) },
      },
      {
        onSuccess: (response) => {
          setResult(response);
          setSelected([]);
          setMessage('');
        },
      },
    );

  const titleOf = (listingId: string) =>
    matches.data?.items.find((m) => m.listing.id === listingId)?.listing.title ?? 'A listing';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Requirement' }} />
      <PreviewBanner />
      <Heading title={item.title} subtitle={`${category} · ${item.city.name}`} />
      <RequirementStatusBadge status={item.status} />

      <View style={{ gap: theme.spacing.xs }}>
        <Field label="Dates" value={formatDateRange(item.startDate, item.endDate, item.days)} />
        <Field label="Machines" value={String(item.quantity)} />
        {item.budgetPerDay !== null ? (
          <Field label="Budget" value={formatDailyRate(item.budgetPerDay)} />
        ) : null}
        {item.notes ? <Field label="Notes" value={item.notes} /> : null}
        {item.sentAt ? <Field label="First sent" value={formatDateTime(item.sentAt)} /> : null}
      </View>

      <Text style={section}>Suppliers asked</Text>
      {item.invitations.length === 0 ? (
        <Text style={muted}>Not sent to anyone yet. Pick suppliers below.</Text>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {item.invitations.map((invitation) => {
            const quote =
              invitation.quote &&
              invitation.quote.status !== 'DRAFT' &&
              invitation.quote.status !== 'PENDING_APPROVAL'
                ? invitation.quote
                : null;
            return (
              <Card
                key={invitation.rentalRequestId}
                title={invitation.listingTitle}
                subtitle={invitation.supplierName}
                aside={<RequestStatusBadge status={invitation.status} />}
                onPress={() =>
                  router.push({
                    pathname: '/requests/[id]',
                    params: { id: invitation.rentalRequestId },
                  })
                }
              >
                {quote ? (
                  <View
                    style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                      Quote: {formatRupees(quote.total)}
                    </Text>
                    <QuoteStatusBadge status={quote.status} />
                  </View>
                ) : invitation.status === 'PENDING' ? (
                  <Text style={muted}>
                    {invitation.viewedAt
                      ? `Seen ${formatDateTime(invitation.viewedAt)}, quote not sent yet`
                      : 'Not opened yet'}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      {result ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.text }}>
            Sent to {result.sent.length} {result.sent.length === 1 ? 'supplier' : 'suppliers'}.
          </Text>
          {result.skipped.map((skip) => (
            <Text key={skip.listingId} style={muted}>
              Skipped {titleOf(skip.listingId)}: {SKIP_REASON[skip.reason]}.
            </Text>
          ))}
        </View>
      ) : null}

      {sendable ? (
        <>
          <Text style={section}>Matching suppliers</Text>
          <Text style={muted}>
            Machines in {item.city.name} with a unit free on your dates. You can ask up to{' '}
            {REQUIREMENT_MAX_SUPPLIERS} suppliers in total ({room} left).
          </Text>
          {matches.isLoading ? (
            <LoadingIndicator />
          ) : !matches.data ? (
            <ErrorMessage message={formErrorsFromApi(matches.error).form} />
          ) : matches.data.items.length === 0 ? (
            <EmptyState
              title="No matches"
              message="No listed machine fits this requirement right now."
            />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {matches.data.items.map((match) => {
                const checked = selected.includes(match.listing.id);
                const disabled = match.alreadyInvited || (!checked && selected.length >= room);
                return (
                  <Pressable
                    key={match.listing.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled }}
                    disabled={disabled}
                    onPress={() => toggle(match.listing.id)}
                    style={{
                      flexDirection: 'row',
                      gap: theme.spacing.sm,
                      alignItems: 'center',
                      padding: theme.spacing.sm,
                      borderWidth: 1,
                      borderRadius: theme.radius.md,
                      borderColor: checked ? theme.colors.primary : theme.colors.border,
                      backgroundColor: theme.colors.surface,
                      opacity: disabled && !match.alreadyInvited ? 0.5 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: theme.radius.sm,
                        borderWidth: 2,
                        borderColor: checked ? theme.colors.primary : theme.colors.border,
                        backgroundColor: checked ? theme.colors.primary : 'transparent',
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                        {match.listing.title}
                      </Text>
                      <Text style={muted}>
                        {match.supplierName} · {formatDailyRate(match.listing.pricePerDay)} ·{' '}
                        {match.alreadyInvited ? 'already asked' : `${match.availableUnits} free`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <TextField
            label="Message to suppliers (optional)"
            value={message}
            onChangeText={setMessage}
            maxLength={RENTAL_REQUEST_MESSAGE_MAX}
            multiline
          />
          <ErrorMessage message={send.error ? formErrorsFromApi(send.error).form : null} />
          <Button
            title={
              selected.length === 0
                ? 'Select suppliers to send'
                : `Send to ${selected.length} ${selected.length === 1 ? 'supplier' : 'suppliers'}`
            }
            disabled={selected.length === 0}
            loading={send.isPending}
            onPress={submitSend}
          />
          <ErrorMessage message={cancel.error ? formErrorsFromApi(cancel.error).form : null} />
          <Button
            title="Cancel requirement"
            variant="secondary"
            loading={cancel.isPending}
            disabled={send.isPending}
            onPress={() => cancel.mutate(item.id)}
          />
        </>
      ) : null}
    </Screen>
  );
}
