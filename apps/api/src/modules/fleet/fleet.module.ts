import { Module } from '@nestjs/common';
import { FleetService } from './application';
import { FLEET_REPOSITORY } from './domain';
import { FleetUnitsController, FleetYardsController } from './http';
import { DrizzleFleetRepository } from './infrastructure';

@Module({
  controllers: [FleetYardsController, FleetUnitsController],
  providers: [FleetService, { provide: FLEET_REPOSITORY, useClass: DrizzleFleetRepository }],
  exports: [FleetService],
})
export class FleetModule {}
