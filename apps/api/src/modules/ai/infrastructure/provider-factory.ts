import type { Env } from '../../../platform/config';
import { AssistantNotConfiguredError, type AiProvider, type ChatResponse } from '../domain';
import { FakeProvider } from './fake-provider';
import { GeminiProvider } from './gemini-provider';

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
