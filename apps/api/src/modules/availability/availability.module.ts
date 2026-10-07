import { Module } from '@nestjs/common';
import { FleetModule } from '../fleet/fleet.module';
import { AvailabilityService } from './application';
import { AVAILABILITY_REPOSITORY } from './domain';
import { PublicListingAvailabilityController, SupplierAvailabilityController } from './http';
import { DrizzleAvailabilityRepository } from './infrastructure';

@Module({
  imports: [FleetModule],
  controllers: [SupplierAvailabilityController, PublicListingAvailabilityController],
  providers: [
    AvailabilityService,
    { provide: AVAILABILITY_REPOSITORY, useClass: DrizzleAvailabilityRepository },
  ],
})
export class AvailabilityModule {}
