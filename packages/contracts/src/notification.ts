import { z } from 'zod';
import { paginationQuery } from './common.js';

export const BUILDER_NOTIFICATION_KINDS = [
  'QUOTE_RECEIVED',
  'JOB_VIEWED',
  'REQUEST_DECLINED',
  'BOOKING_CONFIRMED',
] as const;

export const SUPPLIER_NOTIFICATION_KINDS = [
  'REQUEST_RECEIVED',
  'QUOTE_ACCEPTED',
  'QUOTE_LOST',
  'REQUEST_WITHDRAWN',
] as const;

export const notificationKindSchema = z.enum([
  ...BUILDER_NOTIFICATION_KINDS,
  ...SUPPLIER_NOTIFICATION_KINDS,
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationToneSchema = z.enum(['good', 'waiting', 'neutral']);
export type NotificationTone = z.infer<typeof notificationToneSchema>;

export const NOTIFICATION_TITLE_MAX = 200;
export const NOTIFICATION_DETAIL_MAX = 1000;

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  ...paginationQuery,
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const notificationSchema = z.object({
  id: z.uuid(),
  kind: notificationKindSchema,
  title: z.string(),
  detail: z.string().nullable(),
  /** In-app path, e.g. `/quotes/<id>`. */
  href: z.string().startsWith('/').nullable(),
  tone: notificationToneSchema,
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type NotificationDto = z.infer<typeof notificationSchema>;

/** Newest first. */
export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  unreadCount: z.number().int(),
});
export type NotificationPageDto = z.infer<typeof notificationPageSchema>;

export const markAllNotificationsReadResponseSchema = z.object({
  updated: z.number().int(),
});
export type MarkAllNotificationsReadResponse = z.infer<
  typeof markAllNotificationsReadResponseSchema
>;
