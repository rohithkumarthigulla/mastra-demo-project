import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import { notifications } from '../../../platform/database/schema';
import type {
  DbExecutor,
  NewNotification,
  Notification,
  NotificationList,
  NotificationListQuery,
  NotificationsRepository,
} from '../domain';

const columns = {
  id: notifications.id,
  accountId: notifications.accountId,
  kind: notifications.kind,
  title: notifications.title,
  detail: notifications.detail,
  href: notifications.href,
  tone: notifications.tone,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
};

@Injectable()
export class DrizzleNotificationsRepository implements NotificationsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(accountId: string, query: NotificationListQuery): Promise<NotificationList> {
    const mine = eq(notifications.accountId, accountId);
    const unread = isNull(notifications.readAt);
    const where: SQL = query.unreadOnly ? and(mine, unread)! : mine;
    const [items, totals, unreadTotals] = await Promise.all([
      this.db
        .select(columns)
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ total: count() }).from(notifications).where(where),
      this.db.select({ unreadCount: count() }).from(notifications).where(and(mine, unread)),
    ]);
    return { items, total: totals[0]?.total ?? 0, unreadCount: unreadTotals[0]?.unreadCount ?? 0 };
  }

  async markRead(accountId: string, id: string, now: Date): Promise<Notification | null> {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: sql`COALESCE(${notifications.readAt}, ${now})` })
      .where(and(eq(notifications.id, id), eq(notifications.accountId, accountId)))
      .returning(columns);
    return row ?? null;
  }

  async markAllRead(accountId: string, now: Date): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.accountId, accountId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return rows.length;
  }

  async insertMany(rows: NewNotification[], now: Date, tx: DbExecutor = this.db): Promise<void> {
    await tx.insert(notifications).values(
      rows.map((row) => ({
        accountId: row.accountId,
        kind: row.kind,
        title: row.title,
        detail: row.detail ?? null,
        href: row.href ?? null,
        tone: row.tone,
        createdAt: now,
      })),
    );
  }
}
