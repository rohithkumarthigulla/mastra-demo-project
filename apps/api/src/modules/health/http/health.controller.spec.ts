import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@ee/contracts';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ok', () => {
    const body = new HealthController().check();
    expect(body).toEqual({ status: 'ok' });
    expect(healthResponseSchema.parse(body)).toEqual(body);
  });
});
