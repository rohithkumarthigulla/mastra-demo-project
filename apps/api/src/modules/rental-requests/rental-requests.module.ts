import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalRequestsService } from './application';
import { RentalRequestsController } from './http';

@Module({
  imports: [NotificationsModule],
  controllers: [RentalRequestsController],
  providers: [RentalRequestsService],
})
export class RentalRequestsModule {}
