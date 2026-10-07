import type { NotificationDto } from '@ee/contracts';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formErrorsFromApi } from '../../features/auth';
import { NotificationItem } from '../../features/notifications';
import {
  useMarkAllRead,
  useMarkRead,
  useNotificationFeed,
} from '../../features/progress';
import { useTheme } from '../../features/theme';
import {
  Button,
  Chips,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Pagination,
  Screen,
} from '../../features/ui';

const PAGE_SIZE = 20;
type Filter = 'all' | 'unread';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
];

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const feed = useNotificationFeed({
    unreadOnly: filter === 'unread' ? true : undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const open = (notification: NotificationDto) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    if (notification.href) router.push(notification.href);
  };

  const unread = feed.data?.unreadCount ?? 0;
  const actionError = markRead.error ?? markAll.error;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <Heading
        title="Notifications"
        subtitle={unread === 0 ? 'You’re all caught up' : `${unread} unread`}
      />
      <Chips
        label="Show"
        value={filter}
        options={FILTERS}
        onChange={(next) => {
          setFilter(next);
          setPage(1);
        }}
      />
      {unread > 0 ? (
        <Button
          title="Mark all as read"
          variant="secondary"
          loading={markAll.isPending}
          onPress={() => markAll.mutate()}
        />
      ) : null}
      <ErrorMessage message={actionError ? formErrorsFromApi(actionError).form : null} />
      {feed.isLoading ? (
        <LoadingIndicator />
      ) : !feed.data ? (
        <ErrorMessage message={formErrorsFromApi(feed.error).form} />
      ) : feed.data.items.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          message="Quotes, declines and booking confirmations show up here."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {feed.data.items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onPress={() => open(notification)}
            />
          ))}
          <Pagination page={page} pageSize={PAGE_SIZE} total={feed.data.total} onChange={setPage} />
        </View>
      )}
    </Screen>
  );
}
