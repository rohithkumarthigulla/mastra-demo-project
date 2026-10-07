import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseEnv } from '../../../platform/config';
import {
  AiUnavailableError,
  type AiProvider,
  AssistantNotConfiguredError,
  EMBEDDING_DIMENSIONS,
} from '../domain';
import { FakeProvider } from './fake-provider';
import { GeminiProvider } from './gemini-provider';
import { createAiProvider, UnconfiguredProvider } from './provider-factory';

const base = {
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'x'.repeat(32),
};

const config = { apiKey: 'test-key', chatModel: 'chat', embeddingModel: 'embed', timeoutMs: 50 };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createAiProvider', () => {
  it('is unconfigured without a key and rejects with ASSISTANT_NOT_CONFIGURED', async () => {
    const provider = createAiProvider(parseEnv(base));
    assert.ok(provider instanceof UnconfiguredProvider);
    await assert.rejects(provider.chat(), (e: unknown) => {
      assert.ok(e instanceof AssistantNotConfiguredError);
      assert.equal(e.status, 503);
      assert.equal(e.code, 'ASSISTANT_NOT_CONFIGURED');
      return true;
    });
  });

  it('picks the fake or Gemini provider from the environment', () => {
    assert.ok(createAiProvider(parseEnv({ ...base, AI_PROVIDER: 'fake' })) instanceof FakeProvider);
    assert.ok(
      createAiProvider(parseEnv({ ...base, GEMINI_API_KEY: 'k' })) instanceof GeminiProvider,
    );
  });
});

describe('GeminiProvider', () => {
  it('sends the key as a header, maps tool calls and retries one transient failure', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const responses = [
      json(503, {}),
      json(200, {
        candidates: [
          {
            content: {
              parts: [{ text: 'hi' }, { functionCall: { name: 'search', args: { q: 'x' } } }],
            },
          },
        ],
      }),
    ];
    const fetchFn = ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(responses.shift() as Response);
    }) as typeof fetch;
    const provider = new GeminiProvider(config, fetchFn);
    const reply = await provider.chat({
      system: 's',
      messages: [{ role: 'user', text: 'u' }],
      tools: [],
    });
    assert.deepEqual(reply, { text: 'hi', toolCalls: [{ name: 'search', args: { q: 'x' } }] });
    assert.equal(calls.length, 2);
    const [first] = calls;
    assert.ok(first);
    assert.ok(!first.url.includes('test-key'));
    assert.equal((first.init.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
  });

  it('gives up after the retry with ASSISTANT_UNAVAILABLE', async () => {
    let count = 0;
    const fetchFn = (() => {
      count++;
      return Promise.reject(new Error('network down'));
    }) as typeof fetch;
    await assert.rejects(
      new GeminiProvider(config, fetchFn).embed(['a'], 'query'),
      AiUnavailableError,
    );
    assert.equal(count, 2);
  });

  it('times out a hung request', async () => {
    const fetchFn = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    await assert.rejects(
      new GeminiProvider(config, fetchFn).embed(['a'], 'query'),
      AiUnavailableError,
    );
  });

  it('requests 768-dimensional embeddings and normalizes them', async () => {
    let body: { requests: { outputDimensionality: number; taskType: string }[] } | undefined;
    const fetchFn = ((_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string) as typeof body;
      return Promise.resolve(
        json(200, { embeddings: [{ values: new Array<number>(EMBEDDING_DIMENSIONS).fill(2) }] }),
      );
    }) as typeof fetch;
    const [vector] = await new GeminiProvider(config, fetchFn).embed(['a'], 'document');
    assert.ok(vector);
    assert.equal(body?.requests[0]?.outputDimensionality, EMBEDDING_DIMENSIONS);
    assert.equal(body?.requests[0]?.taskType, 'RETRIEVAL_DOCUMENT');
    assert.equal(vector.length, EMBEDDING_DIMENSIONS);
    assert.ok(Math.abs(Math.hypot(...vector) - 1) < 1e-9);
  });
});

describe('FakeProvider', () => {
  it('embeds deterministically with 768 unit-length dimensions', async () => {
    const provider: AiProvider = new FakeProvider();
    const [a, b, c] = await provider.embed(
      ['How do I block a machine?', 'Blocking machines for maintenance', 'Listing photos'],
      'document',
    );
    assert.ok(a && b && c);
    assert.equal(a.length, EMBEDDING_DIMENSIONS);
    assert.deepEqual(a, (await provider.embed(['How do I block a machine?'], 'query'))[0]);
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * (y[i] ?? 0), 0);
    assert.ok(dot(a, b) > dot(a, c));
  });
});
