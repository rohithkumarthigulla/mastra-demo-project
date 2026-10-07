import { Module } from '@nestjs/common';
import { HealthController } from './http/health.controller';
import { DatabaseHealthCheck } from './infrastructure';

@Module({
  controllers: [HealthController],
  providers: [DatabaseHealthCheck],
})
export class HealthModule {}
