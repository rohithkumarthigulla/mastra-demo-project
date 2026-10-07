import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EquipmentKnowledgeModule } from '../equipment-knowledge/equipment-knowledge.module';
import { EquipmentListingsService } from '../equipment-listings/application';
import { EQUIPMENT_LISTING_REPOSITORY } from '../equipment-listings/domain';
import { DrizzleEquipmentListingsRepository } from '../equipment-listings/infrastructure';
import { EquipmentAssistantService } from './application';
import { ASSISTANT_REPOSITORY } from './domain';
import { EquipmentAssistantController } from './http';
import { DrizzleAssistantRepository } from './infrastructure';

@Module({
  imports: [AiModule, EquipmentKnowledgeModule],
  controllers: [EquipmentAssistantController],
  providers: [
    EquipmentAssistantService,
    { provide: ASSISTANT_REPOSITORY, useClass: DrizzleAssistantRepository },
    // The listings module does not export its service; it is stateless, so the assistant
    // composes its own read-only instance rather than editing that module.
    EquipmentListingsService,
    { provide: EQUIPMENT_LISTING_REPOSITORY, useClass: DrizzleEquipmentListingsRepository },
  ],
})
export class EquipmentAssistantModule {}
