import { Module } from '@nestjs/common';
import { SupplierAgentController } from './http';

@Module({ controllers: [SupplierAgentController] })
export class SupplierAgentModule {}
