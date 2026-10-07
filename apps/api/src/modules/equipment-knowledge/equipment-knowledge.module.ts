import { Module } from '@nestjs/common';
import { EquipmentKnowledgeService } from './application';
import { EQUIPMENT_KNOWLEDGE_REPOSITORY } from './domain';
import {
  EquipmentCategoriesController,
  EquipmentModelsController,
  ManufacturersController,
  SpecificationDefinitionsController,
} from './http';
import { DrizzleEquipmentKnowledgeRepository } from './infrastructure';

@Module({
  controllers: [
    EquipmentCategoriesController,
    ManufacturersController,
    SpecificationDefinitionsController,
    EquipmentModelsController,
  ],
  providers: [
    EquipmentKnowledgeService,
    { provide: EQUIPMENT_KNOWLEDGE_REPOSITORY, useClass: DrizzleEquipmentKnowledgeRepository },
  ],
  exports: [EquipmentKnowledgeService],
})
export class EquipmentKnowledgeModule {}
