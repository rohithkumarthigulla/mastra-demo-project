import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  listNotificationsQuerySchema,
  type ListNotificationsQuery,
  type MarkAllNotificationsReadResponse,
  type NotificationDto,
  type NotificationPageDto,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, type AuthUser } from '../../../platform/auth';
import { IdPipe, ZodValidationPipe } from '../../../platform/http';
import { NotificationsService } from '../application';
import type { Notification } from '../domain';

function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    detail: n.detail,
    href: n.href,
    tone: n.tone,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Any signed-in account; each sees only its own notifications. */
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery,
  ): Promise<NotificationPageDto> {
    const page = await this.notifications.list(user.accountId, {
      unreadOnly: query.unreadOnly ?? false,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      items: page.items.map(toNotificationDto),
      total: page.total,
      limit: query.limit,
      offset: query.offset,
      unreadCount: page.unreadCount,
    };
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentUser() user: AuthUser): Promise<MarkAllNotificationsReadResponse> {
    return { updated: await this.notifications.markAllRead(user.accountId) };
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<NotificationDto> {
    return toNotificationDto(await this.notifications.markRead(user.accountId, id));
  }
}
