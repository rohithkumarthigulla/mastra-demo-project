import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@ee/contracts';
import { DatabaseHealthCheck } from '../infrastructure';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseHealthCheck) {}

  @Get()
  async check(): Promise<HealthResponse> {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException({
        code: 'database_unavailable',
        message: 'Database is unreachable or not migrated',
      });
    }
    return { status: 'ok' };
  }
}
