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
import { EquipmentKnowledgeService } from '../application';
import { EQUIPMENT_KNOWLEDGE_REPOSITORY } from '../domain';
import { InMemoryEquipmentKnowledgeRepository } from '../testing/in-memory-equipment-knowledge.repository';
import {
  EquipmentCategoriesController,
  EquipmentModelsController,
  ManufacturersController,
  SpecificationDefinitionsController,
  SpecificationSourcesController,
} from '.';

const env = parseEnv({
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
});

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

type Method = 'GET' | 'POST' | 'PATCH';

async function createApp() {
  let now = new Date('2026-01-01T00:00:00Z');
  const clock: Clock = { now: () => now };

  @Module({
    imports: [ConfigModule.forRoot(env), JwtModule.register({ secret: env.JWT_SECRET })],
    controllers: [
      EquipmentCategoriesController,
      ManufacturersController,
      SpecificationDefinitionsController,
      SpecificationSourcesController,
      EquipmentModelsController,
    ],
    providers: [
      EquipmentKnowledgeService,
      TokenService,
      AuthGuard,
      RolesGuard,
      { provide: CLOCK, useValue: clock },
      {
        provide: EQUIPMENT_KNOWLEDGE_REPOSITORY,
        useValue: new InMemoryEquipmentKnowledgeRepository(() => now),
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
  const tokenFor = (role: AccountRole) =>
    tokens.signAccessToken({ accountId: '00000000-0000-4000-8000-000000000001', role }).accessToken;
  const admin = tokenFor('ADMIN');

  const request = (method: Method, url: string, token?: string, payload?: object) =>
    server.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const adminPost = async (url: string, payload: object) => {
    const res = await request('POST', url, admin, payload);
    assert.equal(res.statusCode, 201, `${url}: ${res.body}`);
    return res.json();
  };

  /** A manufacturer, category, a length + text definition and one model. */
  const fixture = async () => {
    const manufacturer = await adminPost('/manufacturers', { name: 'JCB' });
    const category = await adminPost('/equipment-categories', {
      code: 'EXCAVATOR',
      displayName: 'Excavator',
    });
    await adminPost('/specification-definitions', {
      code: 'MAX_DIGGING_DEPTH',
      displayName: 'Maximum digging depth',
      valueType: 'NUMERIC',
      canonicalUnit: 'm',
    });
    await adminPost('/specification-definitions', {
      code: 'ENGINE_MODEL',
      displayName: 'Engine model',
      valueType: 'TEXT',
    });
    const model = await adminPost('/equipment-models', {
      manufacturerId: manufacturer.id,
      categoryId: category.id,
      modelName: 'JS220',
    });
    return { manufacturer, category, model };
  };

  return {
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
    tokenFor,
    admin,
    request,
    adminPost,
    fixture,
  };
}

describe('equipment knowledge (integration)', () => {
  it('lets an ADMIN build a model and normalizes 6720 mm to 6.72 m', async () => {
    const http = await createApp();
    const { model } = await http.fixture();

    const spec = await http.adminPost(`/equipment-models/${model.id}/specifications`, {
      definitionCode: 'MAX_DIGGING_DEPTH',
      numericValue: 6720,
      unit: 'mm',
    });
    assert.equal(spec.numericValue, 6720);
    assert.equal(spec.unit, 'mm');

    const res = await http.request('GET', `/equipment-models/${model.id}`);
    assert.equal(res.statusCode, 200);
    const detail = res.json();
    assert.equal(detail.modelName, 'JS220');
    assert.equal(detail.status, 'ACTIVE');
    assert.equal(detail.specifications.length, 1);
    assert.equal(detail.specifications[0].definitionCode, 'MAX_DIGGING_DEPTH');
    assert.equal(detail.specifications[0].normalizedMin, 6.72);
    assert.equal(detail.specifications[0].normalizedMax, 6.72);
  });

  it('rejects invalid specification values with 400', async () => {
    const http = await createApp();
    const { model } = await http.fixture();
    const url = `/equipment-models/${model.id}/specifications`;
    const cases: [object, string][] = [
      [{ numericValue: 20, unit: 'kg' }, 'incompatible_unit'],
      [{ numericValue: -1, unit: 'm' }, 'invalid_specification_value'],
      [{ minValue: 8, maxValue: 2, unit: 'm' }, 'invalid_specification_range'],
      [{ numericValue: 2, minValue: 1, maxValue: 3, unit: 'm' }, 'invalid_specification_shape'],
      [{ numericValue: 2 }, 'invalid_specification_shape'],
    ];
    for (const [body, code] of cases) {
      const res = await http.request('POST', url, http.admin, {
        definitionCode: 'MAX_DIGGING_DEPTH',
        ...body,
      });
      assert.equal(res.statusCode, 400, JSON.stringify(body));
      assert.equal(res.json().code, code, JSON.stringify(body));
    }
    const text = await http.request('POST', url, http.admin, {
      definitionCode: 'ENGINE_MODEL',
      numericValue: 5,
      unit: 'm',
    });
    assert.equal(text.statusCode, 400);
  });

  it('rejects a numeric definition without a canonical unit', async () => {
    const http = await createApp();
    const res = await http.request('POST', '/specification-definitions', http.admin, {
      code: 'WEIGHT',
      displayName: 'Weight',
      valueType: 'NUMERIC',
    });
    assert.equal(res.statusCode, 400);
  });

  it('requires ADMIN for writes and leaves reads public', async () => {
    const http = await createApp();
    const { model } = await http.fixture();
    const spec = await http.adminPost(`/equipment-models/${model.id}/specifications`, {
      definitionCode: 'ENGINE_MODEL',
      textValue: 'Dieselmax 448',
    });
    const writes: [Method, string][] = [
      ['POST', '/equipment-categories'],
      ['POST', '/manufacturers'],
      ['POST', '/specification-definitions'],
      ['POST', '/specification-sources'],
      ['POST', '/equipment-models'],
      ['POST', `/equipment-models/${model.id}/specifications`],
      ['PATCH', `/equipment-models/${model.id}/specifications/${spec.id}`],
    ];
    for (const [method, url] of writes) {
      const unsigned = await http.request(method, url, undefined, {});
      assert.equal(unsigned.statusCode, 401, `unsigned ${method} ${url}`);
      for (const role of ['BUILDER', 'SUPPLIER'] as const) {
        const res = await http.request(method, url, http.tokenFor(role), {});
        assert.equal(res.statusCode, 403, `${role} ${method} ${url}`);
        assert.equal(res.json().code, 'forbidden');
      }
    }
    for (const url of [
      '/equipment-categories',
      '/manufacturers',
      '/specification-definitions',
      '/specification-sources',
      '/equipment-models',
      `/equipment-models/${model.id}`,
    ]) {
      const res = await http.request('GET', url);
      assert.equal(res.statusCode, 200, url);
    }
  });

  it('returns 409 for duplicates', async () => {
    const http = await createApp();
    const { manufacturer, category, model } = await http.fixture();
    const conflicts: [string, object, string][] = [
      ['/equipment-categories', { code: 'EXCAVATOR', displayName: 'Other' }, 'category_exists'],
      ['/manufacturers', { name: 'jcb' }, 'manufacturer_exists'],
      [
        '/specification-definitions',
        { code: 'ENGINE_MODEL', displayName: 'Engine', valueType: 'TEXT' },
        'definition_exists',
      ],
      [
        '/equipment-models',
        { manufacturerId: manufacturer.id, categoryId: category.id, modelName: 'js220' },
        'model_exists',
      ],
    ];
    for (const [url, body, code] of conflicts) {
      const res = await http.request('POST', url, http.admin, body);
      assert.equal(res.statusCode, 409, url);
      assert.equal(res.json().code, code);
    }

    const other = await http.adminPost('/manufacturers', { name: 'Volvo' });
    await http.adminPost('/equipment-models', {
      manufacturerId: other.id,
      categoryId: category.id,
      modelName: 'JS220',
    });

    const specUrl = `/equipment-models/${model.id}/specifications`;
    const body = { definitionCode: 'ENGINE_MODEL', textValue: 'X' };
    await http.adminPost(specUrl, body);
    const dup = await http.request('POST', specUrl, http.admin, body);
    assert.equal(dup.statusCode, 409);
    assert.equal(dup.json().code, 'specification_exists');
  });

  it('returns 404 for missing references and 400 for malformed ids', async () => {
    const http = await createApp();
    const { category, model } = await http.fixture();
    const missing = '00000000-0000-4000-8000-0000000000ff';

    const noMfg = await http.request('POST', '/equipment-models', http.admin, {
      manufacturerId: missing,
      categoryId: category.id,
      modelName: 'X1',
    });
    assert.equal(noMfg.statusCode, 404);
    assert.equal(noMfg.json().code, 'manufacturer_not_found');

    assert.equal((await http.request('GET', `/equipment-models/${missing}`)).statusCode, 404);
    assert.equal((await http.request('GET', '/equipment-models/not-a-uuid')).statusCode, 400);

    const noDef = await http.request(
      'POST',
      `/equipment-models/${model.id}/specifications`,
      http.admin,
      { definitionCode: 'UNKNOWN_SPEC' },
    );
    assert.equal(noDef.statusCode, 404);
    assert.equal(noDef.json().code, 'definition_not_found');

    const noSpec = await http.request(
      'PATCH',
      `/equipment-models/${model.id}/specifications/${missing}`,
      http.admin,
      { textValue: 'Y' },
    );
    assert.equal(noSpec.statusCode, 404);
  });

  it('PATCH merges fields and re-validates the resulting shape', async () => {
    const http = await createApp();
    const { model } = await http.fixture();
    const base = `/equipment-models/${model.id}/specifications`;
    const depth = await http.adminPost(base, {
      definitionCode: 'MAX_DIGGING_DEPTH',
      numericValue: 6720,
      unit: 'mm',
    });

    const partial = await http.request('PATCH', `${base}/${depth.id}`, http.admin, {
      minValue: 5,
    });
    assert.equal(partial.statusCode, 400);

    http.advance(1000);
    const toRange = await http.request('PATCH', `${base}/${depth.id}`, http.admin, {
      numericValue: null,
      minValue: 5000,
      maxValue: 7000,
    });
    assert.equal(toRange.statusCode, 200, toRange.body);
    const range = toRange.json();
    assert.equal(range.numericValue, null);
    assert.equal(range.unit, 'mm');
    assert.equal(range.normalizedMin, 5);
    assert.equal(range.normalizedMax, 7);
    assert.equal(range.updatedAt, '2026-01-01T00:00:01.000Z');
    assert.equal(range.createdAt, depth.createdAt);

    const engine = await http.adminPost(base, { definitionCode: 'ENGINE_MODEL', textValue: 'X' });
    const cleared = await http.request('PATCH', `${base}/${engine.id}`, http.admin, {
      textValue: null,
    });
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.json().textValue, null);
  });

  it('pages equipment models with a total', async () => {
    const http = await createApp();
    const { manufacturer, category } = await http.fixture();
    for (const name of ['JS130', 'JS300', 'JS160']) {
      await http.adminPost('/equipment-models', {
        manufacturerId: manufacturer.id,
        categoryId: category.id,
        modelName: name,
      });
    }

    const page = await http.request('GET', '/equipment-models?limit=2&offset=1');
    assert.equal(page.statusCode, 200);
    const body = page.json();
    assert.equal(body.total, 4);
    assert.equal(body.limit, 2);
    assert.equal(body.offset, 1);
    assert.deepEqual(
      body.items.map((m: { modelName: string }) => m.modelName),
      ['JS160', 'JS220'],
    );

    const defaults = (await http.request('GET', '/equipment-models')).json();
    assert.equal(defaults.limit, 50);
    assert.equal(defaults.items.length, 4);

    assert.equal((await http.request('GET', '/equipment-models?limit=201')).statusCode, 400);
    assert.equal((await http.request('GET', '/equipment-models?offset=-1')).statusCode, 400);
  });

  it('creates and lists specification sources', async () => {
    const http = await createApp();
    const fixture = await http.adminPost('/specification-sources', {
      sourceType: 'TEST_FIXTURE',
      sourceName: 'Seed data',
    });
    assert.equal(fixture.referenceUrl, null);
    assert.equal(fixture.retrievedAt, null);
    const brochure = await http.adminPost('/specification-sources', {
      sourceType: 'MANUFACTURER',
      sourceName: 'JS220 brochure',
      referenceUrl: 'https://example.com/js220.pdf',
      documentName: 'JS220 spec sheet',
      retrievedAt: '2026-01-01',
      notes: 'Page 4',
    });
    assert.equal(brochure.retrievedAt, '2026-01-01');

    const list = (await http.request('GET', '/specification-sources')).json();
    assert.deepEqual(
      list.map((s: { id: string }) => s.id),
      [brochure.id, fixture.id],
    );

    for (const body of [
      { sourceType: 'BLOG', sourceName: 'x' },
      { sourceType: 'MANUFACTURER', sourceName: ' ' },
      { sourceType: 'MANUFACTURER', sourceName: 'x', retrievedAt: 'yesterday' },
      { sourceType: 'MANUFACTURER', sourceName: 'x', extra: true },
    ]) {
      const res = await http.request('POST', '/specification-sources', http.admin, body);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
    }
  });

  it('defaults verification status and returns the source on the model', async () => {
    const http = await createApp();
    const { model } = await http.fixture();
    const base = `/equipment-models/${model.id}/specifications`;
    const source = await http.adminPost('/specification-sources', {
      sourceType: 'MANUFACTURER',
      sourceName: 'JS220 brochure',
      referenceUrl: 'https://example.com/js220.pdf',
    });

    const depth = await http.adminPost(base, {
      definitionCode: 'MAX_DIGGING_DEPTH',
      numericValue: 6720,
      unit: 'mm',
      sourceId: source.id,
    });
    assert.equal(depth.verificationStatus, 'REVIEW_REQUIRED');
    assert.equal(depth.verifiedAt, null);
    const empty = await http.adminPost(base, { definitionCode: 'ENGINE_MODEL' });
    assert.equal(empty.verificationStatus, 'UNKNOWN');
    assert.equal(empty.source, null);

    const detail = (await http.request('GET', `/equipment-models/${model.id}`)).json();
    const [engine, digging] = detail.specifications;
    assert.equal(engine.verificationStatus, 'UNKNOWN');
    assert.equal(digging.verificationStatus, 'REVIEW_REQUIRED');
    assert.deepEqual(digging.source, {
      id: source.id,
      sourceType: 'MANUFACTURER',
      sourceName: 'JS220 brochure',
      referenceUrl: 'https://example.com/js220.pdf',
    });
  });

  it('enforces the verification rules with 400s', async () => {
    const http = await createApp();
    const { model } = await http.fixture();
    const base = `/equipment-models/${model.id}/specifications`;
    const fixture = await http.adminPost('/specification-sources', {
      sourceType: 'TEST_FIXTURE',
      sourceName: 'Seed data',
    });
    const value = { definitionCode: 'MAX_DIGGING_DEPTH', numericValue: 6, unit: 'm' };
    const cases: [object, string][] = [
      [{ ...value, verificationStatus: 'VERIFIED' }, 'verification_source_required'],
      [
        { ...value, verificationStatus: 'VERIFIED', sourceId: fixture.id },
        'test_fixture_not_verifiable',
      ],
      [{ ...value, verificationStatus: 'UNKNOWN' }, 'invalid_verification_status'],
      [
        { definitionCode: 'ENGINE_MODEL', verificationStatus: 'REVIEW_REQUIRED' },
        'invalid_verification_status',
      ],
      [
        { definitionCode: 'ENGINE_MODEL', verificationStatus: 'DEPRECATED' },
        'invalid_verification_status',
      ],
    ];
    for (const [body, code] of cases) {
      const res = await http.request('POST', base, http.admin, body);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
      assert.equal(res.json().code, code, JSON.stringify(body));
    }

    const bad = await http.request('POST', base, http.admin, {
      ...value,
      verificationStatus: 'MAYBE',
    });
    assert.equal(bad.statusCode, 400);
    const missing = await http.request('POST', base, http.admin, {
      ...value,
      sourceId: '00000000-0000-4000-8000-000000000099',
    });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().code, 'source_not_found');

    const fixtureValue = await http.adminPost(base, { ...value, sourceId: fixture.id });
    const promote = await http.request('PATCH', `${base}/${fixtureValue.id}`, http.admin, {
      verificationStatus: 'VERIFIED',
    });
    assert.equal(promote.statusCode, 400);
    assert.equal(promote.json().code, 'test_fixture_not_verifiable');
  });

  it('manages verifiedAt through PATCH', async () => {
    const http = await createApp();
    const { model } = await http.fixture();
    const base = `/equipment-models/${model.id}/specifications`;
    const source = await http.adminPost('/specification-sources', {
      sourceType: 'MANUFACTURER',
      sourceName: 'JS220 brochure',
    });
    const fixture = await http.adminPost('/specification-sources', {
      sourceType: 'TEST_FIXTURE',
      sourceName: 'Seed data',
    });
    const spec = await http.adminPost(base, {
      definitionCode: 'MAX_DIGGING_DEPTH',
      numericValue: 6720,
      unit: 'mm',
      sourceId: source.id,
    });
    const url = `${base}/${spec.id}`;
    const patch = async (body: object) => {
      const res = await http.request('PATCH', url, http.admin, body);
      assert.equal(res.statusCode, 200, `${JSON.stringify(body)}: ${res.body}`);
      return res.json();
    };

    http.advance(1000);
    const verified = await patch({ verificationStatus: 'VERIFIED' });
    assert.equal(verified.verificationStatus, 'VERIFIED');
    assert.equal(verified.verifiedAt, '2026-01-01T00:00:01.000Z');

    http.advance(1000);
    const unchanged = await patch({ numericValue: 6720 });
    assert.equal(unchanged.verificationStatus, 'VERIFIED');
    assert.equal(unchanged.verifiedAt, '2026-01-01T00:00:01.000Z');

    const reverified = await patch({ verificationStatus: 'VERIFIED' });
    assert.equal(reverified.verifiedAt, '2026-01-01T00:00:02.000Z');

    const toFixture = await http.request('PATCH', url, http.admin, { sourceId: fixture.id });
    assert.equal(toFixture.json().code, 'test_fixture_not_verifiable');
    const unsourced = await http.request('PATCH', url, http.admin, { sourceId: null });
    assert.equal(unsourced.json().code, 'verification_source_required');

    const changed = await patch({ numericValue: 7000 });
    assert.equal(changed.verificationStatus, 'REVIEW_REQUIRED');
    assert.equal(changed.verifiedAt, null);
    assert.equal(changed.source.id, source.id);

    await patch({ verificationStatus: 'VERIFIED' });
    const deprecated = await patch({ verificationStatus: 'DEPRECATED' });
    assert.equal(deprecated.verifiedAt, null);

    const cleared = await patch({ numericValue: null, unit: null, sourceId: null });
    assert.equal(cleared.verificationStatus, 'UNKNOWN');
    assert.equal(cleared.source, null);
  });
});
