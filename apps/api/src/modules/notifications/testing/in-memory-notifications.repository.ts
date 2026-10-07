import { randomUUID } from 'node:crypto';
import type {
  NewNotification,
  Notification,
  NotificationList,
  NotificationListQuery,
  NotificationsRepository,
} from '../domain';

export class InMemoryNotificationsRepository implements NotificationsRepository {
  readonly rows: Notification[] = [];

  async list(accountId: string, query: NotificationListQuery): Promise<NotificationList> {
    const mine = this.rows.filter((n) => n.accountId === accountId);
    const matching = (query.unreadOnly ? mine.filter((n) => !n.readAt) : mine).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
    );
    return {
      items: matching.slice(query.offset, query.offset + query.limit).map((n) => ({ ...n })),
      total: matching.length,
      unreadCount: mine.filter((n) => !n.readAt).length,
    };
  }

  async markRead(accountId: string, id: string, now: Date): Promise<Notification | null> {
    const row = this.rows.find((n) => n.id === id && n.accountId === accountId);
    if (!row) return null;
    row.readAt ??= now;
    return { ...row };
  }

  async markAllRead(accountId: string, now: Date): Promise<number> {
    const unread = this.rows.filter((n) => n.accountId === accountId && !n.readAt);
    for (const row of unread) row.readAt = now;
    return unread.length;
  }

  async insertMany(rows: NewNotification[], now: Date): Promise<void> {
    for (const row of rows) {
      this.rows.push({
        id: randomUUID(),
        accountId: row.accountId,
        kind: row.kind,
        title: row.title,
        detail: row.detail ?? null,
        href: row.href ?? null,
        tone: row.tone,
        readAt: null,
        createdAt: now,
      });
    }
  }
}
