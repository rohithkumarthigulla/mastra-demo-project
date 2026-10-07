import type {
  DbExecutor,
  NewNotification,
  Notification,
  NotificationList,
  NotificationListQuery,
} from './notification';

export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');

export interface NotificationsRepository {
  list(accountId: string, query: NotificationListQuery): Promise<NotificationList>;
  /** Sets `readAt` only if unset. Returns null when the id is unknown or another account's. */
  markRead(accountId: string, id: string, now: Date): Promise<Notification | null>;
  /** Returns how many unread notifications were marked. */
  markAllRead(accountId: string, now: Date): Promise<number>;
  insertMany(rows: NewNotification[], now: Date, tx?: DbExecutor): Promise<void>;
}
