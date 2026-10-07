import { Module } from '@nestjs/common';
import { SupplierProfileService } from './application';
import { SUPPLIER_PROFILE_REPOSITORY } from './domain';
import { SupplierProfileController } from './http';
import { DrizzleSupplierProfileRepository } from './infrastructure';

@Module({
  controllers: [SupplierProfileController],
  providers: [
    SupplierProfileService,
    { provide: SUPPLIER_PROFILE_REPOSITORY, useClass: DrizzleSupplierProfileRepository },
  ],
})
export class SupplierProfilesModule {}
