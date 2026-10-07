import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import { Module, type INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AccountRole } from '@ee/contracts';
import { seedEquipmentKnowledge } from '../../../scripts/seed-equipment-knowledge';
import { seedTaxonomy } from '../../../scripts/seed-taxonomy';
import { AuthGuard, CLOCK, RolesGuard, TokenService } from '../../../platform/auth';
import { ConfigModule, parseEnv } from '../../../platform/config';
import { configureApp } from '../../../platform/http';
import { AI_PROVIDER, type AiProvider } from '../../ai/domain';
import { FakeProvider, UnconfiguredProvider } from '../../ai/infrastructure';
import { EquipmentKnowledgeService } from '../../equipment-knowledge/application';
import { EQUIPMENT_KNOWLEDGE_REPOSITORY } from '../../equipment-knowledge/domain';
import { InMemoryEquipmentKnowledgeRepository } from '../../equipment-knowledge/testing/in-memory-equipment-knowledge.repository';
import { EquipmentListingsService } from '../../equipment-listings/application';
import { EQUIPMENT_LISTING_REPOSITORY } from '../../equipment-listings/domain';
import { InMemoryEquipmentListingsRepository } from '../../equipment-listings/testing/in-memory-equipment-listings.repository';
import { EquipmentAssistantService } from '../application';
import { ASSISTANT_REPOSITORY } from '../domain';
import { InMemoryAssistantRepository } from '../testing/in-memory-assistant.repository';
import { EquipmentAssistantController } from './equipment-assistant.controller';

const env = parseEnv({
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
});
const BUILDER_A = randomUUID();
const BUILDER_B = randomUUID();
const HYDERABAD = 'IN-TG-HYD';

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function createApp(provider: AiProvider) {
  const knowledgeRepo = new InMemoryEquipmentKnowledgeRepository();
  const clock = { now: () => new Date('2026-03-02T06:00:00Z') };
  const knowledge = new EquipmentKnowledgeService(knowledgeRepo, clock);
  await seedEquipmentKnowledge(knowledge);
  await seedTaxonomy(knowledge);

  // Mirror the knowledge models into the listings store and list one Caterpillar 320 in Hyderabad.
  const listingsRepo = new InMemoryEquipmentListingsRepository();
  const manufacturers = new Map((await knowledge.listManufacturers()).map((m) => [m.id, m.name]));
  const categories = new Map((await knowledge.listCategories()).map((c) => [c.id, c]));
  const { items: models } = await knowledge.searchModels({
    spec: [],
    status: 'ACTIVE',
    limit: 100,
    offset: 0,
  });
  for (const m of models) {
    const category = categories.get(m.categoryId)!;
    listingsRepo.models.push({
      id: m.id,
      modelName: m.modelName,
      status: 'ACTIVE',
      manufacturer: { id: m.manufacturerId, name: manufacturers.get(m.manufacturerId)! },
      category: { code: category.code, displayName: category.displayName },
    });
  }
  const cityId = randomUUID();
  listingsRepo.cities.push({ id: cityId, geoId: HYDERABAD, name: 'Hyderabad', enabled: true });
  const cat320 = models.find((m) => m.modelName === '320')!;
  const supplierProfileId = randomUUID();
  listingsRepo.profiles.push({ id: supplierProfileId, accountId: randomUUID(), displayName: 'S' });
  const listingId = await listingsRepo.create(
    supplierProfileId,
    {
      modelId: cat320.id,
      cityId,
      title: 'CAT 320 for hire',
      description: 'Well maintained',
      location: 'Gachibowli',
      pricePerDay: 9000,
    },
    clock.now(),
  );
  await listingsRepo.setStatus(listingId, supplierProfileId, 'DRAFT', 'ACTIVE', clock.now());

  @Module({
    imports: [ConfigModule.forRoot(env), JwtModule.register({ secret: env.JWT_SECRET })],
    controllers: [EquipmentAssistantController],
    providers: [
      EquipmentAssistantService,
      EquipmentListingsService,
      TokenService,
      AuthGuard,
      RolesGuard,
      { provide: EquipmentKnowledgeService, useValue: knowledge },
      { provide: EQUIPMENT_KNOWLEDGE_REPOSITORY, useValue: knowledgeRepo },
      { provide: EQUIPMENT_LISTING_REPOSITORY, useValue: listingsRepo },
      { provide: ASSISTANT_REPOSITORY, useValue: new InMemoryAssistantRepository() },
      { provide: AI_PROVIDER, useValue: provider },
      { provide: CLOCK, useValue: clock },
    ],
  })
  class TestModule {}

  const nest = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), {
    logger: false,
  });
  await configureApp(nest, env);
  await nest.init();
  await nest.getHttpAdapter().getInstance().ready();
  app = nest;

  const tokens = nest.get(TokenService);
  const tokenFor = async (accountId: string, role: AccountRole = 'BUILDER') =>
    (await tokens.signAccessToken({ accountId, role })).accessToken;
  const request = async (method: 'GET' | 'POST', url: string, token?: string, payload?: object) =>
    nest
      .getHttpAdapter()
      .getInstance()
      .inject({
        method,
        url,
        payload,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
  const startConversation = async (token: string) => {
    const res = await request('POST', '/equipment-assistant/conversations', token, {});
    assert.equal(res.statusCode, 201);
    return res.json().id as string;
  };
  return { knowledge, cat320, tokenFor, request, startConversation };
}

describe('equipment assistant', () => {
  it('recommends models from knowledge-base tool results for a foundation job', async () => {
    const { knowledge, cat320, tokenFor, request, startConversation } = await createApp(
      new FakeProvider(),
    );
    const token = await tokenFor(BUILDER_A);
    const id = await startConversation(token);

    const res = await request('POST', `/equipment-assistant/conversations/${id}/messages`, token, {
      content: `I need to dig a foundation for a small office block in ${HYDERABAD} from 2026-03-10 to 2026-03-20`,
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();

    const linked = await knowledge.listCapabilityModels('DEEP_EXCAVATION');
    const linkedIds = new Set(linked.map((l) => l.model.id));
    assert.ok(body.recommendations.length > 0);
    for (const rec of body.recommendations) assert.ok(linkedIds.has(rec.modelId));
    const cat = body.recommendations.find((r: { modelId: string }) => r.modelId === cat320.id);
    assert.equal(cat?.manufacturerName, 'Caterpillar');
    assert.equal(cat?.activeListingCount, 1);
    assert.deepEqual(
      body.message.recommendedModelIds,
      body.recommendations.map((r: { modelId: string }) => r.modelId),
    );

    assert.equal(body.draftRequirement.categoryCode, 'EXCAVATOR');
    assert.equal(body.draftRequirement.constructionTaskCode, 'FOUNDATION_EXCAVATION');
    assert.equal(body.draftRequirement.startDate, '2026-03-10');
    assert.equal(body.draftRequirement.endDate, '2026-03-20');

    // Seeded specs are all unverified, so no specification value may appear in the reply.
    const detail = await knowledge.getModel(cat320.id);
    for (const spec of detail.specifications) {
      assert.notEqual(spec.verificationStatus, 'VERIFIED');
      if (spec.numericValue !== null) {
        assert.ok(!body.message.content.includes(String(spec.numericValue)));
      }
    }

    const history = await request('GET', `/equipment-assistant/conversations/${id}`, token);
    assert.equal(history.statusCode, 200);
    assert.deepEqual(
      history.json().messages.map((m: { role: string }) => m.role),
      ['USER', 'ASSISTANT'],
    );
    assert.match(history.json().title, /foundation/);
  });

  it('asks a follow-up for a vague job and drafts nothing', async () => {
    const { tokenFor, request, startConversation } = await createApp(new FakeProvider());
    const token = await tokenFor(BUILDER_A);
    const id = await startConversation(token);

    const res = await request('POST', `/equipment-assistant/conversations/${id}/messages`, token, {
      content: 'I need some machines',
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.deepEqual(body.recommendations, []);
    assert.equal(body.draftRequirement, null);
    assert.match(body.message.content, /\?/);
  });

  it("keeps each builder's conversations private", async () => {
    const { tokenFor, request, startConversation } = await createApp(new FakeProvider());
    const a = await tokenFor(BUILDER_A);
    const b = await tokenFor(BUILDER_B);
    const id = await startConversation(a);

    assert.equal(
      (await request('GET', `/equipment-assistant/conversations/${id}`, b)).statusCode,
      404,
    );
    const send = await request('POST', `/equipment-assistant/conversations/${id}/messages`, b, {
      content: 'hello',
    });
    assert.equal(send.statusCode, 404);
    const list = await request('GET', '/equipment-assistant/conversations', b);
    assert.equal(list.json().total, 0);
    assert.equal((await request('GET', '/equipment-assistant/conversations', a)).json().total, 1);
  });

  it('returns 503 ASSISTANT_NOT_CONFIGURED without an AI key', async () => {
    const { tokenFor, request, startConversation } = await createApp(new UnconfiguredProvider());
    const token = await tokenFor(BUILDER_A);
    const id = await startConversation(token);

    const res = await request('POST', `/equipment-assistant/conversations/${id}/messages`, token, {
      content: 'foundation job',
    });
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().code, 'ASSISTANT_NOT_CONFIGURED');
    const history = await request('GET', `/equipment-assistant/conversations/${id}`, token);
    assert.deepEqual(history.json().messages, []);
  });
});
