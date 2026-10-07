import { Module } from '@nestjs/common';
import { EquipmentKnowledgeService } from './application';
import { EQUIPMENT_KNOWLEDGE_REPOSITORY } from './domain';
import {
  CapabilitiesController,
  ConstructionTasksController,
  EquipmentCategoriesController,
  EquipmentModelsController,
  ManufacturersController,
  SpecificationDefinitionsController,
  SpecificationSourcesController,
} from './http';
import { DrizzleEquipmentKnowledgeRepository } from './infrastructure';

@Module({
  controllers: [
    EquipmentCategoriesController,
    ManufacturersController,
    SpecificationDefinitionsController,
    SpecificationSourcesController,
    EquipmentModelsController,
    CapabilitiesController,
    ConstructionTasksController,
  ],
  providers: [
    EquipmentKnowledgeService,
    { provide: EQUIPMENT_KNOWLEDGE_REPOSITORY, useClass: DrizzleEquipmentKnowledgeRepository },
  ],
  exports: [EquipmentKnowledgeService],
})
export class EquipmentKnowledgeModule {}
