import 'reflect-metadata';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AccountRole } from '@ee/contracts';
import { AuthGuard, CLOCK, RolesGuard, TokenService, type Clock } from '../../../platform/auth';
import { ConfigModule, parseEnv } from '../../../platform/config';
import { configureApp } from '../../../platform/http';
import { SupplierProfileService } from '../application';
import { SUPPLIER_PROFILE_REPOSITORY } from '../domain';
import { InMemorySupplierProfileRepository } from '../testing/in-memory-supplier-profile.repository';
import { SupplierProfileController } from './supplier-profile.controller';

const env = parseEnv({
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
});

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function createApp() {
  let now = new Date('2026-01-01T00:00:00Z');
  const clock: Clock = { now: () => now };

  @Module({
    imports: [ConfigModule.forRoot(env), JwtModule.register({ secret: env.JWT_SECRET })],
    controllers: [SupplierProfileController],
    providers: [
      SupplierProfileService,
      TokenService,
      AuthGuard,
      RolesGuard,
      { provide: CLOCK, useValue: clock },
      {
        provide: SUPPLIER_PROFILE_REPOSITORY,
        useValue: new InMemorySupplierProfileRepository(() => now),
      },
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

  return {
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
    tokenFor: (role: AccountRole, accountId = '00000000-0000-4000-8000-000000000001') =>
      tokens.signAccessToken({ accountId, role }).accessToken,
    request: (method: 'GET' | 'POST' | 'PATCH', token?: string, payload?: object) =>
      server.inject({
        method,
        url: '/supplier-profile',
        payload,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
  };
}

describe('supplier profile (integration)', () => {
  it('returns 401 when signed out on every route', async () => {
    const http = await createApp();
    for (const method of ['GET', 'POST', 'PATCH'] as const) {
      const res = await http.request(method, undefined, { displayName: 'Acme' });
      assert.equal(res.statusCode, 401, method);
      assert.equal(res.json().code, 'unauthenticated');
    }
  });

  it('returns 403 for BUILDER and ADMIN on every route', async () => {
    const http = await createApp();
    for (const role of ['BUILDER', 'ADMIN'] as const) {
      for (const method of ['GET', 'POST', 'PATCH'] as const) {
        const res = await http.request(method, http.tokenFor(role), { displayName: 'Acme' });
        assert.equal(res.statusCode, 403, `${role} ${method}`);
        assert.equal(res.json().code, 'forbidden');
      }
    }
  });

  it('lets a supplier create, read, and update their profile', async () => {
    const http = await createApp();
    const token = http.tokenFor('SUPPLIER');

    const missing = await http.request('GET', token);
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().code, 'supplier_profile_not_found');

    const created = await http.request('POST', token, { displayName: '  Acme Hire  ' });
    assert.equal(created.statusCode, 201);
    const profile = created.json();
    assert.equal(profile.displayName, 'Acme Hire');
    assert.equal(profile.accountId, '00000000-0000-4000-8000-000000000001');
    assert.equal(profile.createdAt, '2026-01-01T00:00:00.000Z');

    assert.deepEqual((await http.request('GET', token)).json(), profile);

    http.advance(60_000);
    const updated = await http.request('PATCH', token, { displayName: 'Acme Plant Hire' });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().displayName, 'Acme Plant Hire');
    assert.equal(updated.json().createdAt, profile.createdAt);
    assert.equal(updated.json().updatedAt, '2026-01-01T00:01:00.000Z');
  });

  it('returns 409 on a second create', async () => {
    const http = await createApp();
    const token = http.tokenFor('SUPPLIER');
    assert.equal((await http.request('POST', token, { displayName: 'Acme' })).statusCode, 201);
    const again = await http.request('POST', token, { displayName: 'Other' });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, 'supplier_profile_exists');
  });

  it('returns 404 when updating a profile that does not exist', async () => {
    const http = await createApp();
    const res = await http.request('PATCH', http.tokenFor('SUPPLIER'), { displayName: 'Acme' });
    assert.equal(res.statusCode, 404);
  });

  it('validates display name length after trimming with 400', async () => {
    const http = await createApp();
    const token = http.tokenFor('SUPPLIER');
    for (const displayName of ['A', '   A   ', 'x'.repeat(121), undefined]) {
      const res = await http.request('POST', token, { displayName });
      assert.equal(res.statusCode, 400, String(displayName));
      assert.equal(res.json().code, 'validation_failed');
    }
    const max = await http.request('POST', token, { displayName: 'x'.repeat(120) });
    assert.equal(max.statusCode, 201);
    const patch = await http.request('PATCH', token, { displayName: ' ' });
    assert.equal(patch.statusCode, 400);
  });

  it('keeps profiles separate per account', async () => {
    const http = await createApp();
    const a = http.tokenFor('SUPPLIER', '00000000-0000-4000-8000-00000000000a');
    const b = http.tokenFor('SUPPLIER', '00000000-0000-4000-8000-00000000000b');
    await http.request('POST', a, { displayName: 'Alpha' });
    assert.equal((await http.request('GET', b)).statusCode, 404);
    assert.equal((await http.request('POST', b, { displayName: 'Beta' })).statusCode, 201);
    assert.equal((await http.request('GET', a)).json().displayName, 'Alpha');
  });
});
