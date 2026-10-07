import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseEnv } from '../../../platform/config';
import { SpeechUnavailableError } from '../domain';
import { FakeSpeechProvider, UnconfiguredSpeechProvider } from './fake-speech';
import { createSpeechProvider } from './provider-factory';
import { SarvamSpeechProvider } from './sarvam-speech';

const base = {
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'x'.repeat(32),
};
const config = { apiKey: 'test-key', timeoutMs: 50 };
const audio = { data: Buffer.from('RIFF'), filename: 'speech.wav', mimeType: 'audio/wav' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createSpeechProvider', () => {
  it('switches voice off without a key and picks fake or Sarvam from the environment', () => {
    const off = createSpeechProvider(parseEnv(base));
    assert.ok(off instanceof UnconfiguredSpeechProvider);
    assert.equal(off.enabled, false);
    assert.ok(
      createSpeechProvider(parseEnv({ ...base, SPEECH_PROVIDER: 'fake' })) instanceof
        FakeSpeechProvider,
    );
    assert.ok(
      createSpeechProvider(parseEnv({ ...base, SARVAM_API_KEY: ' k ' })) instanceof
        SarvamSpeechProvider,
    );
  });
});

describe('SarvamSpeechProvider', () => {
  it('sends the key as a header and reads the transcript and detected language', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchFn = ((url: string, init: RequestInit) => {
      seen = { url, init };
      return Promise.resolve(json(200, { transcript: ' नमस्ते ', language_code: 'hi-IN' }));
    }) as typeof fetch;

    const result = await new SarvamSpeechProvider(config, fetchFn).transcribe(audio);

    assert.deepEqual(result, { text: 'नमस्ते', languageCode: 'hi-IN' });
    assert.equal(seen?.url, 'https://api.sarvam.ai/speech-to-text');
    assert.equal(
      (seen?.init.headers as Record<string, string>)['api-subscription-key'],
      'test-key',
    );
    assert.equal((seen?.init.body as FormData).get('language_code'), 'unknown');
  });

  it('joins the audio chunks it synthesizes', async () => {
    const fetchFn = ((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { target_language_code: string };
      assert.equal(body.target_language_code, 'te-IN');
      return Promise.resolve(
        json(200, {
          audios: [Buffer.from('ab').toString('base64'), Buffer.from('cd').toString('base64')],
        }),
      );
    }) as typeof fetch;

    const wav = await new SarvamSpeechProvider(config, fetchFn).synthesize('hello', 'te-IN');
    assert.equal(wav.toString(), 'abcd');
  });

  it('reports failures and timeouts as SPEECH_UNAVAILABLE', async () => {
    const failing = (() => Promise.resolve(json(500, {}))) as typeof fetch;
    await assert.rejects(
      new SarvamSpeechProvider(config, failing).synthesize('hi', 'en-IN'),
      SpeechUnavailableError,
    );
    const hung = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      )) as typeof fetch;
    await assert.rejects(
      new SarvamSpeechProvider(config, hung).transcribe(audio),
      SpeechUnavailableError,
    );
  });
});

describe('FakeSpeechProvider', () => {
  it('reads an optional language prefix and answers a WAV that grows with the text', async () => {
    const fake = new FakeSpeechProvider();
    const heard = await fake.transcribe({ ...audio, data: Buffer.from('ta-IN|வணக்கம்') });
    assert.deepEqual(heard, { text: 'வணக்கம்', languageCode: 'ta-IN' });
    const short = await fake.synthesize('hi');
    const long = await fake.synthesize('hello there');
    assert.equal(short.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.ok(long.length > short.length);
  });
});
