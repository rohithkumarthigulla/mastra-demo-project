import type { NotificationKind } from '@ee/contracts';
import type { Database } from '../../../platform/database';
import { notifications } from '../../../platform/database/schema';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const TONES = {
  QUOTE_RECEIVED: 'waiting',
  JOB_VIEWED: 'neutral',
  REQUEST_DECLINED: 'neutral',
  BOOKING_CONFIRMED: 'good',
  REQUEST_RECEIVED: 'waiting',
  QUOTE_ACCEPTED: 'good',
  QUOTE_LOST: 'neutral',
  REQUEST_WITHDRAWN: 'neutral',
} as const satisfies Record<NotificationKind, 'good' | 'waiting' | 'neutral'>;

export interface NotificationInput {
  accountId: string;
  kind: NotificationKind;
  title: string;
  detail?: string | null;
  href: string;
}

/**
 * Rental-flow events written straight to the notifications table, inside the
 * caller's transaction so a notification only exists if its event committed.
 */
export async function notify(
  db: Database | Tx,
  items: NotificationInput[],
  now: Date,
): Promise<void> {
  if (items.length === 0) return;
  await db.insert(notifications).values(
    items.map((item) => ({
      accountId: item.accountId,
      kind: item.kind,
      title: item.title,
      detail: item.detail ?? null,
      href: item.href,
      tone: TONES[item.kind],
      createdAt: now,
    })),
  );
}
