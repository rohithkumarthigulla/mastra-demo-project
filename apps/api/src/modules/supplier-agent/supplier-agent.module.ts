import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AvailabilityService } from '../availability/application';
import { AVAILABILITY_REPOSITORY } from '../availability/domain';
import { DrizzleAvailabilityRepository } from '../availability/infrastructure';
import { EquipmentListingsService } from '../equipment-listings/application';
import { EQUIPMENT_LISTING_REPOSITORY } from '../equipment-listings/domain';
import { DrizzleEquipmentListingsRepository } from '../equipment-listings/infrastructure';
import { FleetModule } from '../fleet/fleet.module';
import { SupplierAgentService } from './application';
import { AGENT_REPOSITORY, KNOWLEDGE_REPOSITORY } from './domain';
import { SupplierAgentController } from './http';
import { DrizzleAgentRepository, DrizzleKnowledgeRepository } from './infrastructure';

@Module({
  imports: [AiModule, FleetModule],
  controllers: [SupplierAgentController],
  providers: [
    SupplierAgentService,
    { provide: AGENT_REPOSITORY, useClass: DrizzleAgentRepository },
    { provide: KNOWLEDGE_REPOSITORY, useClass: DrizzleKnowledgeRepository },
    // Availability and listings do not export their services; both are stateless over the
    // database, so the agent composes its own instances instead of editing those modules.
    AvailabilityService,
    { provide: AVAILABILITY_REPOSITORY, useClass: DrizzleAvailabilityRepository },
    EquipmentListingsService,
    { provide: EQUIPMENT_LISTING_REPOSITORY, useClass: DrizzleEquipmentListingsRepository },
  ],
})
export class SupplierAgentModule {}
