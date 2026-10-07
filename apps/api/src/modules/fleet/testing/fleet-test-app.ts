import assert from 'node:assert/strict';
import { Module, type Provider, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AccountRole } from '@ee/contracts';
import { AuthGuard, CLOCK, RolesGuard, TokenService, type Clock } from '../../../platform/auth';
import { ConfigModule, parseEnv } from '../../../platform/config';
import { configureApp } from '../../../platform/http';
import { FleetService } from '../application';
import { FLEET_REPOSITORY } from '../domain';
import { FleetUnitsController, FleetYardsController } from '../http';
import { InMemoryFleetRepository } from './in-memory-fleet.repository';

export const env = parseEnv({
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
});

export const SUPPLIER_A = '00000000-0000-4000-8000-00000000000a';
export const SUPPLIER_B = '00000000-0000-4000-8000-00000000000b';
export const NO_PROFILE = '00000000-0000-4000-8000-00000000000c';
export const LISTING_A = '30000000-0000-4000-8000-00000000000a';
export const LISTING_A2 = '30000000-0000-4000-8000-0000000000a2';
export const LISTING_B = '30000000-0000-4000-8000-00000000000b';
export const UNKNOWN_ID = '99999999-0000-4000-8000-000000000000';

const jcb = { id: '20000000-0000-4000-8000-000000000001', name: 'JCB' };
const excavator = {
  id: '10000000-0000-4000-8000-000000000001',
  modelName: 'JS205',
  manufacturer: jcb,
};

function seed(repo: InMemoryFleetRepository): void {
  repo.cities.push(
    { id: 'c-hyd', geoId: 'IN-TG-HYD', name: 'Hyderabad', enabled: true },
    { id: 'c-blr', geoId: 'IN-KA-BLR', name: 'Bengaluru', enabled: true },
    { id: 'c-off', geoId: 'IN-XX-OFF', name: 'Disabled City', enabled: false },
  );
  repo.profiles.push({ id: 'p-a', accountId: SUPPLIER_A }, { id: 'p-b', accountId: SUPPLIER_B });
  repo.listings.push(
    { id: LISTING_A, supplierProfileId: 'p-a', title: 'JCB excavator', model: excavator },
    { id: LISTING_A2, supplierProfileId: 'p-a', title: 'Second excavator', model: excavator },
    { id: LISTING_B, supplierProfileId: 'p-b', title: 'Beta excavator', model: excavator },
  );
}

let app: NestFastifyApplication | undefined;

/** Call from `afterEach` in every spec that uses `createFleetApp`. */
export async function closeFleetApp(): Promise<void> {
  await app?.close();
  app = undefined;
}

/** Lets other modules' specs (e.g. availability) mount their controllers on top of fleet. */
export interface FleetAppExtension {
  controllers?: Type[];
  providers?: (repo: InMemoryFleetRepository) => Provider[];
}

export async function createFleetApp(extension: FleetAppExtension = {}) {
  let now = new Date('2026-01-01T00:00:00Z');
  const clock: Clock = { now: () => now };
  const repo = new InMemoryFleetRepository();
  seed(repo);

  @Module({
    imports: [ConfigModule.forRoot(env), JwtModule.register({ secret: env.JWT_SECRET })],
    controllers: [FleetYardsController, FleetUnitsController, ...(extension.controllers ?? [])],
    providers: [
      ...(extension.providers?.(repo) ?? []),
      FleetService,
      TokenService,
      AuthGuard,
      RolesGuard,
      { provide: CLOCK, useValue: clock },
      { provide: FLEET_REPOSITORY, useValue: repo },
    ],
  })
  class TestModule {}

  app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), {
    logger: false,
  });
  await configureApp(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const server = app;
  const tokens = app.get(TokenService);

  const tokenFor = (role: AccountRole, accountId = SUPPLIER_A) =>
    tokens.signAccessToken({ accountId, role }).accessToken;
  const request = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    token?: string,
    payload?: object,
  ) =>
    server.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const supplierA = tokenFor('SUPPLIER', SUPPLIER_A);
  const supplierB = tokenFor('SUPPLIER', SUPPLIER_B);

  async function createYard(token: string, overrides: object = {}) {
    const res = await request('POST', '/fleet/yards', token, {
      name: 'Main yard',
      cityGeoId: 'IN-TG-HYD',
      address: 'Plot 12, Gachibowli',
      ...overrides,
    });
    assert.equal(res.statusCode, 201, res.body);
    return res.json<{ id: string; name: string }>();
  }

  async function createUnit(token: string, body: object) {
    const res = await request('POST', '/fleet/units', token, {
      modelYear: 2021,
      condition: 'GOOD',
      ...body,
    });
    assert.equal(res.statusCode, 201, res.body);
    // Distinct createdAt values keep "newest first" ordering deterministic.
    now = new Date(now.getTime() + 1000);
    return res.json<{ id: string; status: string }>();
  }

  const setNow = (instant: Date) => {
    now = instant;
  };

  return {
    app: server,
    request,
    tokenFor,
    supplierA,
    supplierB,
    createYard,
    createUnit,
    repo,
    setNow,
  };
}
