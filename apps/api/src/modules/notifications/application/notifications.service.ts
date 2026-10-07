import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../platform/auth';
import {
  NOTIFICATIONS_REPOSITORY,
  NotificationNotFoundError,
  type DbExecutor,
  type NewNotification,
  type Notification,
  type NotificationList,
  type NotificationListQuery,
  type NotificationsRepository,
} from '../domain';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY) private readonly repo: NotificationsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  list(accountId: string, query: NotificationListQuery): Promise<NotificationList> {
    return this.repo.list(accountId, query);
  }

  async markRead(accountId: string, id: string): Promise<Notification> {
    const notification = await this.repo.markRead(accountId, id, this.clock.now());
    if (!notification) throw new NotificationNotFoundError();
    return notification;
  }

  markAllRead(accountId: string): Promise<number> {
    return this.repo.markAllRead(accountId, this.clock.now());
  }

  /**
   * Sends in-app notifications. Pass the caller's transaction so the notifications commit or
   * roll back together with the state change that caused them.
   */
  async notify(rows: NewNotification[], tx?: DbExecutor): Promise<void> {
    if (rows.length === 0) return;
    await this.repo.insertMany(rows, this.clock.now(), tx);
  }
}
