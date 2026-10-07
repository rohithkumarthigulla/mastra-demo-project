import { Module } from '@nestjs/common';
import { EquipmentListingsService } from './application';
import { EQUIPMENT_LISTING_REPOSITORY } from './domain';
import { PublicListingsController, SupplierListingsController } from './http';
import { DrizzleEquipmentListingsRepository } from './infrastructure';

@Module({
  controllers: [SupplierListingsController, PublicListingsController],
  providers: [
    EquipmentListingsService,
    { provide: EQUIPMENT_LISTING_REPOSITORY, useClass: DrizzleEquipmentListingsRepository },
  ],
})
export class EquipmentListingsModule {}
