import type { Env } from '../../../platform/config';
import {
  AssistantNotConfiguredError,
  type AiProvider,
  type ChatResponse,
  type SpeechProvider,
} from '../domain';
import { FakeProvider } from './fake-provider';
import { FakeSpeechProvider, UnconfiguredSpeechProvider } from './fake-speech';
import { GeminiProvider } from './gemini-provider';
import { SarvamSpeechProvider } from './sarvam-speech';

/** Lets the API boot without a key; every assistant call answers 503. */
export class UnconfiguredProvider implements AiProvider {
  readonly embeddingModel = 'none';

  chat(): Promise<ChatResponse> {
    return Promise.reject(new AssistantNotConfiguredError());
  }

  embed(): Promise<number[][]> {
    return Promise.reject(new AssistantNotConfiguredError());
  }
}

export function createAiProvider(env: Env): AiProvider {
  if (env.AI_PROVIDER === 'fake') return new FakeProvider();
  if (!env.GEMINI_API_KEY) return new UnconfiguredProvider();
  return new GeminiProvider({
    apiKey: env.GEMINI_API_KEY,
    chatModel: env.GEMINI_CHAT_MODEL,
    embeddingModel: env.GEMINI_EMBEDDING_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
  });
}

export function createSpeechProvider(env: Env): SpeechProvider {
  if (env.SPEECH_PROVIDER === 'fake') return new FakeSpeechProvider();
  if (!env.SARVAM_API_KEY) return new UnconfiguredSpeechProvider();
  return new SarvamSpeechProvider({ apiKey: env.SARVAM_API_KEY, timeoutMs: env.AI_TIMEOUT_MS });
}
