import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequirementsService } from './application';
import { REQUIREMENTS_REPOSITORY } from './domain';
import { RequirementsController } from './http';
import { DrizzleRequirementsRepository } from './infrastructure';

@Module({
  imports: [NotificationsModule],
  controllers: [RequirementsController],
  providers: [
    RequirementsService,
    { provide: REQUIREMENTS_REPOSITORY, useClass: DrizzleRequirementsRepository },
  ],
})
export class RequirementsModule {}
