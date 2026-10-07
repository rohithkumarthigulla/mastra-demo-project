import { Module } from '@nestjs/common';
import { RentalRequestsService } from './application';
import { RentalRequestsController } from './http';

@Module({ controllers: [RentalRequestsController], providers: [RentalRequestsService] })
export class RentalRequestsModule {}
