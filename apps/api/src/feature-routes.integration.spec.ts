import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  allFeatureRoutes,
  todayInRentalZone,
  type AccountRole,
  type RouteContract,
} from '@ee/contracts';
import { AppModule } from './app.module';
import { ROLES_KEY, TokenService } from './platform/auth';
import { parseEnv } from './platform/config';
import { configureApp } from './platform/http';

// The pg pool connects lazily and no stub touches it, so no database is needed.
const env = parseEnv({
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
});

const ID = '00000000-0000-4000-8000-000000000001';
const FEATURE_PREFIXES = [
  '/rental-requests',
  '/supplier/listings/:id/rate-card',
  '/quotes',
  '/bookings',
  '/requirements',
  '/notifications',
  '/equipment-assistant',
  '/supplier-agent',
];

interface RegisteredRoute {
  method: string;
  path: string;
  roles: readonly AccountRole[];
}

const joinPath = (...parts: (string | undefined)[]) =>
  '/' +
  parts
    .flatMap((part) => (part ?? '').split('/'))
    .filter(Boolean)
    .join('/');

/** Every route Nest registered, read from controller metadata. */
function registeredRoutes(app: NestFastifyApplication): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new (...args: never[]) => object) | null;
      if (!controller) continue;
      const base = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
      const classRoles = Reflect.getMetadata(ROLES_KEY, controller) as AccountRole[] | undefined;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (method === undefined) continue;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const roles = (Reflect.getMetadata(ROLES_KEY, handler) ??
          classRoles ??
          []) as AccountRole[];
        routes.push({ method: RequestMethod[method], path: joinPath(base, path), roles });
      }
    }
  }
  return routes;
}

const key = (route: { method: string; path: string }) => `${route.method} ${route.path}`;
const url = (route: RouteContract) => route.path.replaceAll(':id', ID);

function dateFromToday(days: number): string {
  const date = new Date(`${todayInRentalZone()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A body each route's schema accepts, so the call gets past validation to the stub. */
function validBody(route: RouteContract): object | undefined {
  const dates = { startDate: dateFromToday(1), endDate: dateFromToday(3) };
  switch (key(route)) {
    case 'POST /rental-requests':
      return { listingId: ID, ...dates };
    case 'POST /rental-requests/:id/reject':
    case 'POST /quotes/:id/reject':
    case 'POST /equipment-assistant/conversations':
    case 'POST /supplier-agent/conversations':
      return {};
    case 'PUT /supplier/listings/:id/rate-card':
      return {
        weekRate: 10000,
        monthRate: null,
        transportFee: 1500,
        operatorRatePerDay: null,
        depositAmount: 5000,
      };
    case 'POST /quotes':
      return {
        rentalRequestId: ID,
        lines: [{ type: 'RENTAL', description: 'Excavator', quantity: 3, unitAmount: 4000 }],
      };
    case 'PATCH /quotes/:id':
      return { notes: 'Includes operator' };
    case 'POST /bookings/:id/cancel':
      return { reason: 'Site not ready' };
    case 'POST /requirements':
      return {
        title: 'Excavator for basement',
        categoryCode: 'EXCAVATOR',
        cityGeoId: 'IN-TG-HYD',
        ...dates,
      };
    case 'PATCH /requirements/:id':
      return { title: 'Excavator for foundation' };
    case 'POST /requirements/:id/send':
      return { listingIds: [ID] };
    case 'POST /equipment-assistant/conversations/:id/messages':
    case 'POST /supplier-agent/conversations/:id/messages':
      return { content: 'Which machine digs a 3m trench?' };
    default:
      assert.equal(route.body, undefined, `no sample body for ${key(route)}`);
      return undefined;
  }
}

describe('feature routes (in-process)', () => {
  let app: NestFastifyApplication;
  let tokenFor: (role: AccountRole) => string;

  const call = (route: RouteContract, token?: string, payload?: object, query = '') =>
    app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: route.method,
        url: url(route) + query,
        payload,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });

  before(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule.forRoot(env),
      new FastifyAdapter(),
      { logger: false },
    );
    await configureApp(app, env);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const tokens = app.get(TokenService);
    tokenFor = (role) => tokens.signAccessToken({ accountId: ID, role }).accessToken;
  });

  after(async () => {
    await app.close();
  });

  it('registers exactly the contract routes with the contract roles', () => {
    const registered = registeredRoutes(app).filter((route) =>
      FEATURE_PREFIXES.some((prefix) => route.path.startsWith(prefix)),
    );
    const byKey = new Map(registered.map((route) => [key(route), route]));
    assert.equal(byKey.size, registered.length, 'duplicate route registered');
    assert.deepEqual([...byKey.keys()].sort(), allFeatureRoutes.map(key).sort());
    for (const route of allFeatureRoutes) {
      assert.deepEqual(
        [...(byKey.get(key(route))?.roles ?? [])].sort(),
        [...route.roles].sort(),
        `roles for ${key(route)}`,
      );
    }
  });

  for (const route of allFeatureRoutes) {
    const allowed: AccountRole[] =
      route.roles.length > 0 ? [...route.roles] : ['BUILDER', 'SUPPLIER'];
    const denied = (['BUILDER', 'SUPPLIER'] as const).filter((role) => !allowed.includes(role));

    describe(key(route), () => {
      it('is 401 without a token', async () => {
        const res = await call(route, undefined, validBody(route));
        assert.equal(res.statusCode, 401);
      });

      for (const role of denied) {
        it(`is 403 for ${role}`, async () => {
          const res = await call(route, tokenFor(role), validBody(route));
          assert.equal(res.statusCode, 403);
          assert.equal(res.json().code, 'forbidden');
        });
      }

      for (const role of allowed) {
        it(`is 501 for ${role} with valid input`, async () => {
          const res = await call(route, tokenFor(role), validBody(route));
          assert.equal(res.statusCode, 501, res.body);
          assert.equal(res.json().code, 'NOT_IMPLEMENTED');
        });
      }

      if (route.body) {
        it('is 400 for an invalid body', async () => {
          const res = await call(route, tokenFor(allowed[0]!), { unexpected: true });
          assert.equal(res.statusCode, 400);
          assert.equal(res.json().code, 'validation_failed');
        });
      }

      if (route.query) {
        it('is 400 for an invalid query', async () => {
          const res = await call(route, tokenFor(allowed[0]!), undefined, '?limit=0');
          assert.equal(res.statusCode, 400);
          assert.equal(res.json().code, 'validation_failed');
        });
      }

      if (route.path.includes(':id')) {
        it('is 404 for a malformed id', async () => {
          const res = await app
            .getHttpAdapter()
            .getInstance()
            .inject({
              method: route.method,
              url: route.path.replaceAll(':id', 'not-a-uuid'),
              payload: validBody(route),
              headers: { authorization: `Bearer ${tokenFor(allowed[0]!)}` },
            });
          assert.equal(res.statusCode, 404);
        });
      }
    });
  }
});
