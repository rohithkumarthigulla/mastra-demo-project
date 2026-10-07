import { Module } from '@nestjs/common';
import { NotificationsController } from './http';

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
