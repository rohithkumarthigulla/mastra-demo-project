import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  listNotificationsQuerySchema,
  type ListNotificationsQuery,
  type MarkAllNotificationsReadResponse,
  type NotificationDto,
  type NotificationPageDto,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, type AuthUser } from '../../../platform/auth';
import { IdPipe, notImplemented, ZodValidationPipe } from '../../../platform/http';

/** Any signed-in account; each sees only its own notifications. */
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery,
  ): Promise<NotificationPageDto> {
    return notImplemented(user, query);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: AuthUser): Promise<MarkAllNotificationsReadResponse> {
    return notImplemented(user);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<NotificationDto> {
    return notImplemented(user, id);
  }
}
