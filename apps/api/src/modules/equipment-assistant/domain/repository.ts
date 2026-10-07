import type { ChatRole } from '@ee/contracts';
import { NotFoundError } from '../../../platform/http';

export const ASSISTANT_REPOSITORY = Symbol('ASSISTANT_REPOSITORY');

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredMessage {
  id: string;
  role: ChatRole;
  content: string;
  recommendedModelIds: string[];
  createdAt: Date;
}

export interface NewMessage {
  role: ChatRole;
  content: string;
  recommendedModelIds: string[];
}

/** Every read is scoped to the builder, so another builder's conversation is simply absent. */
export interface AssistantRepository {
  createConversation(
    builderAccountId: string,
    title: string,
    now: Date,
  ): Promise<StoredConversation>;
  listConversations(
    builderAccountId: string,
    page: { limit: number; offset: number },
  ): Promise<{ items: StoredConversation[]; total: number }>;
  findConversation(builderAccountId: string, id: string): Promise<StoredConversation | null>;
  renameConversation(id: string, title: string): Promise<void>;
  listMessages(conversationId: string): Promise<StoredMessage[]>;
  /** Appends messages in order and bumps the conversation's `updatedAt`. */
  addMessages(conversationId: string, messages: NewMessage[], now: Date): Promise<StoredMessage[]>;
}

export class ConversationNotFoundError extends NotFoundError {
  constructor() {
    super('conversation_not_found', 'Conversation not found');
  }
}
