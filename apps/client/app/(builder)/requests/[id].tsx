import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { ApiError } from '../../../api';
import { formErrorsFromApi } from '../../../features/auth';
import {
  Field,
  formatDateRange,
  PreviewBanner,
  QuoteStatusBadge,
  RequestStatusBadge,
  requestStage,
  requestTimeline,
  StageBar,
  Timeline,
  useCancelRequest,
  useRequest,
} from '../../../features/progress';
import { formatRupees } from '../../../features/rental';
import { useTheme } from '../../../features/theme';
import { Button, ErrorMessage, Heading, LoadingIndicator, Screen } from '../../../features/ui';

const SUPPLIER_DRAFTS = new Set(['DRAFT', 'PENDING_APPROVAL']);

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const request = useRequest(id);
  const cancel = useCancelRequest();

  if (request.isLoading) return <LoadingIndicator />;
  if (!request.data) {
    const notFound = request.error instanceof ApiError && request.error.status === 404;
    return (
      <Screen centered>
        <Stack.Screen options={{ title: 'Request' }} />
        <ErrorMessage
          message={notFound ? 'This request doesn’t exist.' : formErrorsFromApi(request.error).form}
        />
      </Screen>
    );
  }

  const item = request.data;
  const quote =
    item.latestQuote && !SUPPLIER_DRAFTS.has(item.latestQuote.status) ? item.latestQuote : null;
  const section = {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  } as const;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Request' }} />
      <PreviewBanner />
      <Heading title={item.listing.title} subtitle={`From ${item.supplierName}`} />
      <RequestStatusBadge status={item.status} />
      <StageBar state={requestStage(item)} />

      <View style={{ gap: theme.spacing.xs }}>
        <Field label="Dates" value={formatDateRange(item.startDate, item.endDate, item.days)} />
        <Field label="Listed rate" value={`${formatRupees(item.listing.pricePerDay)} / day`} />
        <Field label="City" value={item.listing.city} />
        {item.message ? <Field label="Your message" value={item.message} /> : null}
        {item.declineReason ? <Field label="Declined because" value={item.declineReason} /> : null}
      </View>
      <Link
        href={{ pathname: '/listing/[id]', params: { id: item.listing.id } }}
        style={{ color: theme.colors.primary, fontWeight: '600' }}
      >
        View listing
      </Link>

      <Text style={section}>Quote</Text>
      {quote ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text
              style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' }}
            >
              {formatRupees(quote.total)}
            </Text>
            <QuoteStatusBadge status={quote.status} />
          </View>
          <Button
            title={quote.status === 'SENT' ? 'Review quote' : 'View quote'}
            onPress={() => router.push({ pathname: '/quotes/[id]', params: { id: quote.id } })}
          />
        </View>
      ) : (
        <Text style={{ color: theme.colors.textMuted }}>
          {item.status === 'PENDING'
            ? item.viewedAt
              ? 'The supplier has seen your request and is preparing a quote.'
              : 'Waiting for the supplier to open your request.'
            : 'No quote was sent.'}
        </Text>
      )}

      <Text style={section}>History</Text>
      <Timeline entries={requestTimeline(item)} />

      {item.status === 'PENDING' ? (
        <View style={{ gap: theme.spacing.xs }}>
          <ErrorMessage message={cancel.error ? formErrorsFromApi(cancel.error).form : null} />
          <Button
            title="Cancel request"
            variant="secondary"
            loading={cancel.isPending}
            onPress={() => cancel.mutate(item.id)}
          />
        </View>
      ) : null}
    </Screen>
  );
}
