import { Module } from '@nestjs/common';
import { NotificationsService } from './application';
import { NOTIFICATIONS_REPOSITORY } from './domain';
import { NotificationsController } from './http';
import { DrizzleNotificationsRepository } from './infrastructure';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFICATIONS_REPOSITORY, useClass: DrizzleNotificationsRepository },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
