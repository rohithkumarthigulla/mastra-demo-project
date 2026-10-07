import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import type {
  AgentConversationDetailDto,
  AgentProgressDto,
  AgentReplyDto,
  PendingActionDto,
  SendAgentMessageRequest,
  SpeechStatusDto,
  TranscriptionDto,
} from '@ee/contracts';
import {
  AI_PROVIDER,
  SPEECH_PROVIDER,
  type AiProvider,
  type SpeechProvider,
} from '../../ai/domain';
import {
  FakeProvider,
  FakeSpeechProvider,
  UnconfiguredProvider,
  UnconfiguredSpeechProvider,
} from '../../ai/infrastructure';
import { AvailabilityService } from '../../availability/application';
import { AVAILABILITY_REPOSITORY } from '../../availability/domain';
import { InMemoryAvailabilityRepository } from '../../availability/testing/in-memory-availability.repository';
import { EquipmentListingsService } from '../../equipment-listings/application';
import { EQUIPMENT_LISTING_REPOSITORY } from '../../equipment-listings/domain';
import { InMemoryEquipmentListingsRepository } from '../../equipment-listings/testing/in-memory-equipment-listings.repository';
import {
  closeFleetApp,
  createFleetApp,
  LISTING_A,
  SUPPLIER_A,
  SUPPLIER_B,
} from '../../fleet/testing/fleet-test-app';
import { RentalRequestsService } from '../../rental-requests/application';
import { AgentSpeechService, ingestKnowledge, SupplierAgentService } from '../application';
import { AGENT_REPOSITORY, KNOWLEDGE_REPOSITORY } from '../domain';
import { readKnowledgeFiles } from '../infrastructure/knowledge-files';
import { InMemoryAgentRepository, InMemoryKnowledgeRepository } from '../testing';
import { SupplierAgentController } from './supplier-agent.controller';

const KNOWLEDGE_ROOT = resolve(__dirname, '../../../../../../docs/knowledge');
// The fleet test clock starts on Thursday 2026-01-01, so "next week" is 5–11 January.
const NEXT_MONDAY = '2026-01-04T18:30:00.000Z';
const FOLLOWING_MONDAY = '2026-01-11T18:30:00.000Z';

async function createAgentApp(
  ai: AiProvider = new FakeProvider(),
  speech: SpeechProvider = new FakeSpeechProvider(),
) {
  const knowledge = new InMemoryKnowledgeRepository();
  await ingestKnowledge(knowledge, new FakeProvider(), await readKnowledgeFiles(KNOWLEDGE_ROOT));
  const agents = new InMemoryAgentRepository();
  const listings = new InMemoryEquipmentListingsRepository();
  listings.cities.push({ id: 'c-hyd', geoId: 'IN-TG-HYD', name: 'Hyderabad', enabled: true });
  listings.profiles.push(
    { id: 'p-a', accountId: SUPPLIER_A, displayName: 'Alpha Rentals' },
    { id: 'p-b', accountId: SUPPLIER_B, displayName: 'Beta Rentals' },
  );
  listings.models.push({
    id: '10000000-0000-4000-8000-000000000002',
    modelName: 'TMX 20',
    status: 'ACTIVE',
    manufacturer: { id: '20000000-0000-4000-8000-000000000002', name: 'Tata Hitachi' },
    category: { code: 'CRANE', displayName: 'Crane' },
  });
  let blocks: InMemoryAvailabilityRepository | undefined;

  const fleet = await createFleetApp({
    controllers: [SupplierAgentController],
    providers: (repo) => {
      blocks = new InMemoryAvailabilityRepository(repo.activeUnitIdsFor);
      return [
        SupplierAgentService,
        AgentSpeechService,
        AvailabilityService,
        EquipmentListingsService,
        { provide: AI_PROVIDER, useValue: ai },
        { provide: SPEECH_PROVIDER, useValue: speech },
        { provide: AGENT_REPOSITORY, useValue: agents },
        { provide: KNOWLEDGE_REPOSITORY, useValue: knowledge },
        { provide: AVAILABILITY_REPOSITORY, useValue: blocks },
        { provide: EQUIPMENT_LISTING_REPOSITORY, useValue: listings },
        // Rental requests need the real database; see supplier-agent.database.spec.ts.
        { provide: RentalRequestsService, useValue: {} },
      ];
    },
  });
  const availability = fleet.app.get(AvailabilityService);

  async function conversation(token: string) {
    const res = await fleet.request('POST', '/supplier-agent/conversations', token, {});
    assert.equal(res.statusCode, 201, res.body);
    return res.json<{ id: string }>().id;
  }

  async function say(
    token: string,
    conversationId: string,
    content: string,
    options: Omit<SendAgentMessageRequest, 'content'> = {},
  ) {
    const res = await fleet.request(
      'POST',
      `/supplier-agent/conversations/${conversationId}/messages`,
      token,
      { content, ...options },
    );
    assert.equal(res.statusCode, 201, res.body);
    return res.json<AgentReplyDto>();
  }

  async function activeUnit(token = fleet.supplierA) {
    const yard = await fleet.createYard(token, { name: 'North yard' });
    return fleet.createUnit(token, { listingId: LISTING_A, yardId: yard.id, label: 'Big Digger' });
  }

  async function blocksOf(accountId: string) {
    const lanes = await availability.fleetCalendar(accountId, {
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-03-01T00:00:00Z'),
    });
    return lanes.flatMap((l) => l.blocks);
  }

  function transcribe(token: string, audio: string, query = '') {
    const boundary = '----agent-speech-test';
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="speech.wav"\r\n` +
          'Content-Type: audio/wav\r\n\r\n',
      ),
      Buffer.from(audio, 'utf8'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return fleet.app.inject({
      method: 'POST',
      url: `/supplier-agent/speech/transcribe${query}`,
      payload,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
    });
  }

  return { ...fleet, agents, listings, conversation, say, activeUnit, blocksOf, transcribe };
}

type AgentApp = Awaited<ReturnType<typeof createAgentApp>>;

function action(app: AgentApp, verb: 'confirm' | 'cancel', id: string, token = app.supplierA) {
  return app.request('POST', `/supplier-agent/actions/${id}/${verb}`, token);
}

describe('supplier agent', () => {
  afterEach(closeFleetApp);

  it('answers how-to questions from the platform guides with citations', async () => {
    const app = await createAgentApp();
    const id = await app.conversation(app.supplierA);

    const reply = await app.say(app.supplierA, id, 'How do I block a machine for maintenance?');

    assert.equal(reply.pendingAction, null);
    assert.ok(reply.citations.length > 0);
    assert.ok(reply.citations.some((c) => c.topic === 'machines.blocking'));
    assert.match(reply.message.content, /According to the platform guides/);
    assert.deepEqual(
      reply.message.citedDocumentIds,
      reply.citations.map((c) => c.documentId),
    );
  });

  it('proposes a block and changes nothing until the supplier confirms', async () => {
    const app = await createAgentApp();
    const unit = await app.activeUnit();
    const id = await app.conversation(app.supplierA);

    const reply = await app.say(app.supplierA, id, 'Block Big Digger next week for maintenance');

    const pending = reply.pendingAction;
    assert.ok(pending);
    assert.equal(pending.type, 'BLOCK_UNIT');
    assert.equal(pending.status, 'PENDING');
    assert.match(pending.summary, /Block Big Digger .*2026-01-05 to 2026-01-11.*maintenance/);
    assert.equal(pending.expiresAt, '2026-01-01T00:10:01.000Z');
    assert.deepEqual(await app.blocksOf(SUPPLIER_A), []);

    const detail = await app.request('GET', `/supplier-agent/conversations/${id}`, app.supplierA);
    assert.equal(detail.json<AgentConversationDetailDto>().pendingActions[0]?.id, pending.id);

    const confirmed = await action(app, 'confirm', pending.id);
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    assert.equal(confirmed.json<PendingActionDto>().status, 'CONFIRMED');
    const [block] = await app.blocksOf(SUPPLIER_A);
    assert.equal(block?.unitId, unit.id);
    assert.equal(block?.reason, 'MAINTENANCE');
    assert.equal(block?.startAt.toISOString(), NEXT_MONDAY);
    assert.equal(block?.endAt.toISOString(), FOLLOWING_MONDAY);

    const again = await action(app, 'confirm', pending.id);
    assert.equal(again.statusCode, 409);
    assert.equal(again.json<{ code: string }>().code, 'pending_action_closed');
    assert.equal((await app.blocksOf(SUPPLIER_A)).length, 1);
  });

  it('refuses to confirm an expired or cancelled action', async () => {
    const app = await createAgentApp();
    await app.activeUnit();
    const id = await app.conversation(app.supplierA);

    const first = (await app.say(app.supplierA, id, 'Block Big Digger next week for repairs'))
      .pendingAction!;
    app.setNow(new Date('2026-01-01T00:10:02Z'));
    const expired = await action(app, 'confirm', first.id);
    assert.equal(expired.statusCode, 409);
    assert.equal(expired.json<{ code: string }>().code, 'pending_action_expired');
    assert.equal(app.agents.actions.find((a) => a.id === first.id)?.status, 'EXPIRED');

    const second = (await app.say(app.supplierA, id, 'Block Big Digger next week for repairs'))
      .pendingAction!;
    const cancelled = await action(app, 'cancel', second.id);
    assert.equal(cancelled.statusCode, 200);
    assert.equal(cancelled.json<PendingActionDto>().status, 'CANCELLED');
    assert.equal((await action(app, 'confirm', second.id)).statusCode, 409);
    assert.deepEqual(await app.blocksOf(SUPPLIER_A), []);
  });

  it('lifts a block and updates a listing price only after confirmation', async () => {
    const app = await createAgentApp();
    const unit = await app.activeUnit();
    const availability = app.app.get(AvailabilityService);
    const block = await availability.createBlock(SUPPLIER_A, unit.id, {
      reason: 'TRANSPORT',
      startAt: NEXT_MONDAY,
      endAt: FOLLOWING_MONDAY,
    });
    const id = await app.conversation(app.supplierA);

    const lift = (await app.say(app.supplierA, id, `Please lift block ${block.id}`)).pendingAction!;
    assert.equal(lift.type, 'LIFT_BLOCK');
    assert.equal((await app.blocksOf(SUPPLIER_A)).length, 1);
    assert.equal((await action(app, 'confirm', lift.id)).statusCode, 200);
    assert.deepEqual(await app.blocksOf(SUPPLIER_A), []);

    const listingId = await app.listings.create(
      'p-a',
      {
        modelId: '10000000-0000-4000-8000-000000000002',
        cityId: 'c-hyd',
        title: 'Crane for hire',
        description: 'Mobile crane',
        location: 'Gachibowli',
        pricePerDay: 9000,
      },
      new Date('2026-01-01T00:00:00Z'),
    );
    const price = (await app.say(app.supplierA, id, 'Set the price of Crane for hire to ₹12,500'))
      .pendingAction!;
    assert.equal(price.type, 'UPDATE_LISTING_PRICE');
    assert.match(price.summary, /₹9000 to ₹12500/);
    const listings = app.app.get(EquipmentListingsService);
    assert.equal((await listings.getOwn(SUPPLIER_A, listingId)).pricePerDay, 9000);
    assert.equal((await action(app, 'confirm', price.id)).statusCode, 200);
    assert.equal((await listings.getOwn(SUPPLIER_A, listingId)).pricePerDay, 12500);
  });

  it("keeps each supplier's data and actions private", async () => {
    const app = await createAgentApp();
    await app.activeUnit();
    const id = await app.conversation(app.supplierA);
    const pending = (await app.say(app.supplierA, id, 'Block Big Digger next week for repairs'))
      .pendingAction!;

    const other = await app.request('GET', `/supplier-agent/conversations/${id}`, app.supplierB);
    assert.equal(other.statusCode, 404);
    const send = await app.request(
      'POST',
      `/supplier-agent/conversations/${id}/messages`,
      app.supplierB,
      { content: 'hello' },
    );
    assert.equal(send.statusCode, 404);
    assert.equal((await action(app, 'confirm', pending.id, app.supplierB)).statusCode, 404);
    assert.equal((await action(app, 'cancel', pending.id, app.supplierB)).statusCode, 404);
    assert.deepEqual(await app.blocksOf(SUPPLIER_A), []);

    // Supplier B's tools only see B's (empty) fleet, so A's machine cannot be targeted.
    const ownId = await app.conversation(app.supplierB);
    const reply = await app.say(app.supplierB, ownId, 'Block Big Digger next week for repairs');
    assert.equal(reply.pendingAction, null);
    const listed = await app.request('GET', '/supplier-agent/conversations', app.supplierB);
    assert.deepEqual(
      listed.json<{ items: { id: string }[] }>().items.map((c) => c.id),
      [ownId],
    );
  });

  it('replies in the language decided by speech, script and the picker', async () => {
    const app = await createAgentApp();
    const id = await app.conversation(app.supplierA);

    const english = await app.say(app.supplierA, id, 'How do I block a machine?');
    assert.equal(english.language, 'en');
    assert.doesNotMatch(english.message.content, /^\[/);

    // Nothing typed settles the script, so the picker decides.
    const picked = await app.say(app.supplierA, id, '12500?', { language: 'te' });
    assert.equal(picked.language, 'te');
    assert.match(picked.message.content, /^\[te\] /);

    // Typed Devanagari with Marathi picked: same script, so the selection wins.
    const sameScript = await app.say(app.supplierA, id, 'मशीन कैसे ब्लॉक करें?', {
      language: 'mr',
    });
    assert.equal(sameScript.language, 'mr');

    // Typed Latin with Telugu picked: a different script wins over the selection.
    const otherScript = await app.say(app.supplierA, id, 'How do I block a machine?', {
      language: 'te',
    });
    assert.equal(otherScript.language, 'en');

    const spoken = await app.say(app.supplierA, id, 'How do I block a machine?', {
      language: 'te',
      spokenLanguage: 'ta',
    });
    assert.equal(spoken.language, 'ta');
  });

  it('shows the pending action summary in the reply language', async () => {
    const app = await createAgentApp();
    await app.activeUnit();
    const id = await app.conversation(app.supplierA);

    const reply = await app.say(app.supplierA, id, 'Block Big Digger next week for repairs', {
      language: 'en',
      spokenLanguage: 'hi',
    });

    assert.equal(reply.language, 'hi');
    assert.match(reply.pendingAction!.summary, /^\[hi\] Block Big Digger/);
  });

  it('reports no activity when no reply is in flight', async () => {
    const app = await createAgentApp();
    const id = await app.conversation(app.supplierA);
    const progress = (path: string, token = app.supplierA) => app.request('GET', path, token);

    const res = await progress(`/supplier-agent/conversations/${id}/progress`);
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.json<AgentProgressDto>(), { activity: null });

    const other = await progress(`/supplier-agent/conversations/${id}/progress`, app.supplierB);
    assert.equal(other.statusCode, 404);
  });

  it('runs a spoken turn: speech in, an answer in the spoken language, speech out', async () => {
    const app = await createAgentApp();
    const id = await app.conversation(app.supplierA);

    const status = await app.request('GET', '/supplier-agent/speech', app.supplierA);
    assert.deepEqual(status.json<SpeechStatusDto>(), { enabled: true });

    const heard = await app.transcribe(app.supplierA, 'hi-IN|मशीन कैसे ब्लॉक करें?');
    assert.equal(heard.statusCode, 200, heard.body);
    const transcript = heard.json<TranscriptionDto>();
    assert.deepEqual(transcript, { text: 'मशीन कैसे ब्लॉक करें?', language: 'hi' });

    const reply = await app.say(app.supplierA, id, transcript.text, {
      language: 'en',
      spokenLanguage: transcript.language ?? undefined,
    });
    assert.equal(reply.language, 'hi');

    const audio = await app.request(
      'GET',
      `/supplier-agent/speech/audio?language=hi&text=${encodeURIComponent('नमस्ते')}`,
      app.supplierA,
    );
    assert.equal(audio.statusCode, 200, audio.body);
    assert.equal(audio.headers['content-type'], 'audio/wav');
    assert.equal(audio.rawPayload.subarray(0, 4).toString('ascii'), 'RIFF');
  });

  it('uses the picked language as a hint and rejects a missing recording', async () => {
    const app = await createAgentApp();

    const hinted = await app.transcribe(app.supplierA, 'hello', '?language=ta');
    assert.deepEqual(hinted.json<TranscriptionDto>(), { text: 'hello', language: 'ta' });

    const empty = await app.request('POST', '/supplier-agent/speech/transcribe', app.supplierA, {});
    assert.equal(empty.statusCode, 400);
  });

  it('switches voice off without a speech key', async () => {
    const app = await createAgentApp(new FakeProvider(), new UnconfiguredSpeechProvider());

    const status = await app.request('GET', '/supplier-agent/speech', app.supplierA);
    assert.deepEqual(status.json<SpeechStatusDto>(), { enabled: false });

    const heard = await app.transcribe(app.supplierA, 'hello');
    assert.equal(heard.statusCode, 503);
    assert.equal(heard.json<{ code: string }>().code, 'SPEECH_NOT_CONFIGURED');
    const audio = await app.request(
      'GET',
      '/supplier-agent/speech/audio?language=en&text=hi',
      app.supplierA,
    );
    assert.equal(audio.statusCode, 503);
  });

  it('returns 503 ASSISTANT_NOT_CONFIGURED without an AI key', async () => {
    const app = await createAgentApp(new UnconfiguredProvider());
    const id = await app.conversation(app.supplierA);

    const res = await app.request(
      'POST',
      `/supplier-agent/conversations/${id}/messages`,
      app.supplierA,
      {
        content: 'How do I block a machine?',
      },
    );

    assert.equal(res.statusCode, 503);
    assert.equal(res.json<{ code: string }>().code, 'ASSISTANT_NOT_CONFIGURED');
  });
});
