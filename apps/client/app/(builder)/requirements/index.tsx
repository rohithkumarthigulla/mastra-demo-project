import { requirementStatusSchema, type RequirementStatus } from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formErrorsFromApi } from '../../../features/auth';
import {
  Card,
  formatDateRange,
  PreviewBanner,
  REQUIREMENT_STATUS,
  RequirementStatusBadge,
  useMyRequirements,
} from '../../../features/progress';
import { useTheme } from '../../../features/theme';
import {
  Button,
  Chips,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Pagination,
  Screen,
} from '../../../features/ui';

const PAGE_SIZE = 20;
type Filter = 'ALL' | RequirementStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...requirementStatusSchema.options.map((status) => ({
    value: status,
    label: REQUIREMENT_STATUS[status].label,
  })),
];

export default function MyRequirementsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);

  const requirements = useMyRequirements({
    ...(filter === 'ALL' ? {} : { status: filter }),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Requirements' }} />
      <PreviewBanner />
      <Heading
        title="Requirements"
        subtitle="Describe what you need once and send it to several suppliers"
      />
      <Button title="Post a requirement" onPress={() => router.push('/requirements/new')} />
      <Chips
        label="Status"
        value={filter}
        options={FILTERS}
        onChange={(next) => {
          setFilter(next);
          setPage(1);
        }}
      />
      {requirements.isLoading ? (
        <LoadingIndicator />
      ) : !requirements.data ? (
        <ErrorMessage message={formErrorsFromApi(requirements.error).form} />
      ) : requirements.data.items.length === 0 ? (
        <EmptyState
          title={filter === 'ALL' ? 'No requirements yet' : 'Nothing here'}
          message={
            filter === 'ALL'
              ? 'Post a requirement and we’ll suggest suppliers with machines free on your dates.'
              : undefined
          }
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {requirements.data.items.map((item) => (
            <Card
              key={item.id}
              title={item.title}
              subtitle={`${item.city.name} · ${formatDateRange(item.startDate, item.endDate, item.days)}`}
              aside={<RequirementStatusBadge status={item.status} />}
              onPress={() =>
                router.push({ pathname: '/requirements/[id]', params: { id: item.id } })
              }
            >
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                {item.quantity} {item.quantity === 1 ? 'machine' : 'machines'} ·{' '}
                {item.invitationCount === 0
                  ? 'not sent yet'
                  : `sent to ${item.invitationCount} ${item.invitationCount === 1 ? 'supplier' : 'suppliers'}`}
              </Text>
            </Card>
          ))}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={requirements.data.total}
            onChange={setPage}
          />
        </View>
      )}
    </Screen>
  );
}
