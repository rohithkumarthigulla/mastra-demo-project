import { KNOWLEDGE_EMBEDDING_DIMENSIONS } from '@ee/contracts';
import { DomainError } from '../../../platform/http';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export const EMBEDDING_DIMENSIONS = KNOWLEDGE_EMBEDDING_DIMENSIONS;

/** JSON-schema subset understood by both Gemini function calling and the fake. */
export interface ToolParameters {
  type: 'object';
  properties: Record<string, { type: 'string' | 'number' | 'integer'; description: string }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export type ChatTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; name: string; result: unknown };

export interface ChatRequest {
  system: string;
  messages: ChatTurn[];
  tools: ToolDefinition[];
}

export interface ChatResponse {
  text: string;
  toolCalls: ToolCall[];
}

export type EmbeddingPurpose = 'document' | 'query';

/** The only way the app talks to a language model. */
export interface AiProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  /** One vector of `EMBEDDING_DIMENSIONS` numbers per text, in input order. */
  embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]>;
}

export class AssistantNotConfiguredError extends DomainError {
  constructor() {
    super('ASSISTANT_NOT_CONFIGURED', 'The assistant is not set up on this server', 503);
  }
}

export class AiUnavailableError extends DomainError {
  constructor() {
    super('ASSISTANT_UNAVAILABLE', 'The assistant is temporarily unavailable', 503);
  }
}
