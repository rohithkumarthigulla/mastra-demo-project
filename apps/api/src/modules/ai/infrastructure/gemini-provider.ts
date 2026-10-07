import {
  AiUnavailableError,
  EMBEDDING_DIMENSIONS,
  type AiProvider,
  type ChatRequest,
  type ChatResponse,
  type ChatTurn,
  type EmbeddingPurpose,
  type ToolCall,
} from '../domain';
import { normalize } from './vector';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const EMBED_BATCH_MAX = 100;

export interface GeminiConfig {
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
  timeoutMs: number;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

class TransientError extends Error {}

/** Google Gemini over plain HTTPS. Never logs the key or prompts. */
export class GeminiProvider implements AiProvider {
  constructor(
    private readonly config: GeminiConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: toContents(request.messages),
      ...(request.tools.length > 0 ? { tools: [{ functionDeclarations: request.tools }] } : {}),
    };
    const data = (await this.post(`models/${this.config.chatModel}:generateContent`, body)) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const toolCalls: ToolCall[] = [];
    const text: string[] = [];
    for (const part of parts) {
      if (part.functionCall) {
        toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
      } else if (typeof part.text === 'string') {
        text.push(part.text);
      }
    }
    return { text: text.join('').trim(), toolCalls };
  }

  async embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH_MAX) {
      const batch = texts.slice(i, i + EMBED_BATCH_MAX);
      const model = `models/${this.config.embeddingModel}`;
      const data = (await this.post(`${model}:batchEmbedContents`, {
        requests: batch.map((text) => ({
          model,
          content: { parts: [{ text }] },
          taskType: purpose === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      })) as { embeddings?: { values?: number[] }[] };
      const embeddings = data.embeddings ?? [];
      if (embeddings.length !== batch.length) throw new AiUnavailableError();
      for (const e of embeddings) {
        if (e.values?.length !== EMBEDDING_DIMENSIONS) throw new AiUnavailableError();
        out.push(normalize(e.values));
      }
    }
    return out;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    try {
      return await this.attempt(path, body);
    } catch (error) {
      if (!(error instanceof TransientError)) throw error;
    }
    try {
      return await this.attempt(path, body);
    } catch (error) {
      if (error instanceof TransientError) throw new AiUnavailableError();
      throw error;
    }
  }

  private async attempt(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchFn(`${BASE_URL}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.config.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new TransientError('network');
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 429 || response.status >= 500) throw new TransientError('http');
    if (!response.ok) throw new AiUnavailableError();
    try {
      return await response.json();
    } catch {
      throw new AiUnavailableError();
    }
  }
}

function toContents(turns: ChatTurn[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const turn of turns) {
    let content: GeminiContent;
    if (turn.role === 'user') {
      content = { role: 'user', parts: [{ text: turn.text }] };
    } else if (turn.role === 'assistant') {
      const parts: GeminiPart[] = turn.text ? [{ text: turn.text }] : [];
      for (const call of turn.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.args } });
      }
      content = { role: 'model', parts };
    } else {
      content = {
        role: 'user',
        parts: [{ functionResponse: { name: turn.name, response: { result: turn.result } } }],
      };
    }
    const last = contents[contents.length - 1];
    if (last && last.role === content.role) last.parts.push(...content.parts);
    else contents.push(content);
  }
  return contents;
}
