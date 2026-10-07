import type { QuoteStatus } from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSupplierQuotes } from '../../api';
import { useSession } from '../../features/auth';
import { formatRupees } from '../../features/rental';
import {
  Card,
  CardTitle,
  formatDateRange,
  Muted,
  QuoteStatusBadge,
  supplierErrorMessage,
} from '../../features/supplier';
import { useTheme } from '../../features/theme';
import {
  Chips,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Pagination,
  Screen,
} from '../../features/ui';

const PAGE_SIZE = 20;

type StatusFilter = QuoteStatus | 'ALL';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING_APPROVAL', label: 'Awaiting approval' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
];

export default function SupplierQuotesScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const quotes = useSupplierQuotes(api, {
    status: status === 'ALL' ? undefined : status,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Quotes' }} />
      <Heading title="Quotes" subtitle="Every quote you've drafted or sent." />
      <Chips
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
      />
      <ErrorMessage message={supplierErrorMessage(quotes.error)} />
      {quotes.isLoading ? (
        <LoadingIndicator />
      ) : quotes.data && quotes.data.items.length > 0 ? (
        <>
          <View style={{ gap: theme.spacing.sm }}>
            {quotes.data.items.map((quote) => (
              <Card
                key={quote.id}
                label={`Quote for ${quote.builderName}`}
                onPress={() =>
                  router.push({
                    pathname: '/supplier/pipeline/quotes/[id]',
                    params: { id: quote.id },
                  })
                }
              >
                <CardTitle>{quote.builderName}</CardTitle>
                <Muted>
                  {quote.listing.title} ·{' '}
                  {formatDateRange(quote.rentalRequest.startDate, quote.rentalRequest.endDate)}
                </Muted>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
                  <QuoteStatusBadge status={quote.status} />
                  <Muted>{formatRupees(quote.total)}</Muted>
                </View>
              </Card>
            ))}
          </View>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={quotes.data.total}
            onChange={setPage}
          />
        </>
      ) : quotes.data ? (
        <EmptyState title="No quotes yet" message="Open a rental request to quote for it." />
      ) : null}
    </Screen>
  );
}
