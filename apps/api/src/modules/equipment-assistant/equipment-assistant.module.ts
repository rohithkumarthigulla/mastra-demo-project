import { Module } from '@nestjs/common';
import { EquipmentAssistantController } from './http';

@Module({ controllers: [EquipmentAssistantController] })
export class EquipmentAssistantModule {}
