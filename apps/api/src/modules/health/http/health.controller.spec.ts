import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { healthResponseSchema } from '@ee/contracts';
import type { DatabaseHealthCheck } from '../infrastructure';
import { HealthController } from './health.controller';

function controller(ready: boolean): HealthController {
  const check = { isReady: async () => ready } as DatabaseHealthCheck;
  return new HealthController(check);
}

describe('HealthController', () => {
  it('reports ok when the database is ready', async () => {
    const body = await controller(true).check();
    assert.deepEqual(body, { status: 'ok' });
    assert.deepEqual(healthResponseSchema.parse(body), body);
  });

  it('responds 503 when the database is not ready', async () => {
    await assert.rejects(controller(false).check(), (error: unknown) => {
      assert.ok(error instanceof ServiceUnavailableException);
      assert.equal(error.getStatus(), 503);
      assert.deepEqual(error.getResponse(), {
        code: 'database_unavailable',
        message: 'Database is unreachable or not migrated',
      });
      return true;
    });
  });
});
