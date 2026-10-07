import { Module } from '@nestjs/common';
import { ReferenceService } from './application';
import { REFERENCE_REPOSITORY } from './domain';
import { ReferenceController } from './http';
import { DrizzleReferenceRepository } from './infrastructure';

@Module({
  controllers: [ReferenceController],
  providers: [
    ReferenceService,
    { provide: REFERENCE_REPOSITORY, useClass: DrizzleReferenceRepository },
  ],
  exports: [ReferenceService],
})
export class ReferenceModule {}
