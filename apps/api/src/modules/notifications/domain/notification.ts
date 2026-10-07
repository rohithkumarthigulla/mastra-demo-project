import type { NotificationKind, NotificationTone } from '@ee/contracts';
import type { Database } from '../../../platform/database';
import { NotFoundError } from '../../../platform/http';

export interface Notification {
  id: string;
  accountId: string;
  kind: NotificationKind;
  title: string;
  detail: string | null;
  href: string | null;
  tone: NotificationTone;
  readAt: Date | null;
  createdAt: Date;
}

export interface NewNotification {
  accountId: string;
  kind: NotificationKind;
  title: string;
  detail?: string | null;
  /** In-app path starting with `/`. */
  href?: string | null;
  tone: NotificationTone;
}

/** A notification to send; `tone` defaults to the kind's usual tone. */
export type NotificationDraft = Omit<NewNotification, 'tone'> & { tone?: NotificationTone };

export const NOTIFICATION_TONES = {
  QUOTE_RECEIVED: 'waiting',
  JOB_VIEWED: 'neutral',
  REQUEST_DECLINED: 'neutral',
  BOOKING_CONFIRMED: 'good',
  REQUEST_RECEIVED: 'waiting',
  QUOTE_ACCEPTED: 'good',
  QUOTE_LOST: 'neutral',
  REQUEST_WITHDRAWN: 'neutral',
} as const satisfies Record<NotificationKind, NotificationTone>;

export interface NotificationListQuery {
  unreadOnly: boolean;
  limit: number;
  offset: number;
}

export interface NotificationList {
  items: Notification[];
  total: number;
  /** Unread notifications across the whole account, not just this page. */
  unreadCount: number;
}

/** The database or an open transaction, so notifications can be written atomically. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export class NotificationNotFoundError extends NotFoundError {
  constructor() {
    super('notification_not_found', 'Notification not found');
  }
}
