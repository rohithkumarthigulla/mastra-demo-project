import {
  markAllNotificationsReadResponseSchema,
  notificationPageSchema,
  notificationSchema,
  type MarkAllNotificationsReadResponse,
  type NotificationDto,
  type NotificationPageDto,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString, type ApiClient, type ApiRequest } from './client';

const id = encodeURIComponent;

export interface NotificationsQuery {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export function createNotificationsApi(request: ApiRequest) {
  return {
    list: ({ unreadOnly, ...page }: NotificationsQuery = {}): Promise<NotificationPageDto> =>
      request(
        `/notifications${toQueryString({ ...page, unreadOnly: unreadOnly === undefined ? undefined : String(unreadOnly) })}`,
        { schema: notificationPageSchema },
      ),
    markRead: (notificationId: string): Promise<NotificationDto> =>
      request(`/notifications/${id(notificationId)}/read`, {
        method: 'POST',
        schema: notificationSchema,
      }),
    markAllRead: (): Promise<MarkAllNotificationsReadResponse> =>
      request('/notifications/read-all', {
        method: 'POST',
        schema: markAllNotificationsReadResponseSchema,
      }),
  };
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (query: NotificationsQuery = {}) => ['notifications', query] as const,
};

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

export function useNotifications(api: ApiClient, query: NotificationsQuery = {}) {
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: () => api.notifications.list(query),
  });
}

export function useMarkNotificationRead(api: ApiClient) {
  const invalidate = useInvalidateNotifications();
  return useMutation({ mutationFn: api.notifications.markRead, onSuccess: invalidate });
}

export function useMarkAllNotificationsRead(api: ApiClient) {
  const invalidate = useInvalidateNotifications();
  return useMutation({ mutationFn: api.notifications.markAllRead, onSuccess: invalidate });
}
