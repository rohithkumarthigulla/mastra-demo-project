import 'reflect-metadata';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { publicReferenceSchema } from '@ee/contracts';
import { ReferenceService } from '../application';
import { REFERENCE_REPOSITORY } from '../domain';
import { seedReference } from '../seed/seed-reference';
import { InMemoryReferenceRepository } from '../testing/in-memory-reference.repository';
import { ReferenceController } from '.';

let app: NestFastifyApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function createApp() {
  @Module({
    controllers: [ReferenceController],
    providers: [
      ReferenceService,
      { provide: REFERENCE_REPOSITORY, useValue: new InMemoryReferenceRepository() },
    ],
  })
  class TestModule {}

  app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), {
    logger: false,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('public reference (integration)', () => {
  it('serves the seeded cities and entity types without signing in, cacheably', async () => {
    const server = await createApp();
    const first = await seedReference(server.get(ReferenceService));
    assert.deepEqual(first, { cities: 16, entityTypes: 5 });

    const res = await server.inject({ method: 'GET', url: '/public/reference' });
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers['cache-control']), /^public, max-age=\d+$/);
    const body = publicReferenceSchema.parse(res.json());
    assert.ok(body.cities.length >= 15);
    assert.deepEqual(
      body.cities.filter((c) => c.enabled).map((c) => c.name),
      ['Bengaluru', 'Chennai', 'Delhi', 'Hyderabad', 'Mumbai', 'Pune'],
    );
    assert.deepEqual(
      body.entityTypes.map((e) => e.code),
      ['LLP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'SOLE_PROPRIETORSHIP'],
    );
    assert.deepEqual(body.cities[0], {
      geoId: 'IN-AMD',
      name: 'Ahmedabad',
      state: 'Gujarat',
      enabled: false,
    });
  });

  it('seeds idempotently', async () => {
    const server = await createApp();
    const service = server.get(ReferenceService);
    await seedReference(service);
    assert.deepEqual(await seedReference(service), { cities: 0, entityTypes: 0 });
    const { cities, entityTypes } = await service.getPublicReference();
    assert.equal(cities.length, 16);
    assert.equal(entityTypes.length, 5);
  });
});
