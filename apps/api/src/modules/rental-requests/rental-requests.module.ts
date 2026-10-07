import { Module } from '@nestjs/common';
import { RentalRequestsController } from './http';

@Module({ controllers: [RentalRequestsController] })
export class RentalRequestsModule {}
