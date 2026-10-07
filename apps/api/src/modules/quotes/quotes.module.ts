import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuotesService } from './application';
import { QuotesController } from './http';

@Module({
  imports: [NotificationsModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
