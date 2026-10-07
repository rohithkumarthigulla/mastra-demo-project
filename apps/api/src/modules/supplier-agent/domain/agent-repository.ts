import type { ChatRole, PendingActionStatus, PendingActionType } from '@ee/contracts';
import { ConflictError, DomainError, NotFoundError } from '../../../platform/http';

export const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');

/** How long a proposed change waits for the supplier before it lapses. */
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

export interface StoredAgentConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredAgentMessage {
  id: string;
  role: ChatRole;
  content: string;
  citedDocumentIds: string[];
  createdAt: Date;
}

export interface NewAgentMessage {
  role: ChatRole;
  content: string;
  citedDocumentIds: string[];
}

/** What confirming will do, plus the sentence shown to the supplier. */
export interface ActionPayload {
  summary: string;
  args: Record<string, unknown>;
}

export interface StoredPendingAction {
  id: string;
  conversationId: string;
  type: PendingActionType;
  status: PendingActionStatus;
  payload: ActionPayload;
  expiresAt: Date;
  createdAt: Date;
}

export interface NewPendingAction {
  type: PendingActionType;
  payload: ActionPayload;
  expiresAt: Date;
}

/** Every read is scoped to the supplier profile, so another supplier's rows are simply absent. */
export interface AgentRepository {
  createConversation(
    supplierProfileId: string,
    title: string,
    now: Date,
  ): Promise<StoredAgentConversation>;
  listConversations(
    supplierProfileId: string,
    page: { limit: number; offset: number },
  ): Promise<{ items: StoredAgentConversation[]; total: number }>;
  findConversation(supplierProfileId: string, id: string): Promise<StoredAgentConversation | null>;
  renameConversation(id: string, title: string): Promise<void>;
  listMessages(conversationId: string): Promise<StoredAgentMessage[]>;
  /** Appends messages in order and bumps the conversation's `updatedAt`. */
  addMessages(
    conversationId: string,
    messages: NewAgentMessage[],
    now: Date,
  ): Promise<StoredAgentMessage[]>;
  createAction(
    conversationId: string,
    action: NewPendingAction,
    now: Date,
  ): Promise<StoredPendingAction>;
  listActions(conversationId: string): Promise<StoredPendingAction[]>;
  findAction(supplierProfileId: string, id: string): Promise<StoredPendingAction | null>;
  /**
   * Atomically moves an action from `from` to `to`. With `liveAt`, only actions that have not
   * expired by then move. Returns false when another request got there first.
   */
  transitionAction(
    id: string,
    from: PendingActionStatus,
    to: PendingActionStatus,
    now: Date,
    liveAt?: Date,
  ): Promise<boolean>;
}

export class AgentConversationNotFoundError extends NotFoundError {
  constructor() {
    super('conversation_not_found', 'Conversation not found');
  }
}

export class PendingActionNotFoundError extends NotFoundError {
  constructor() {
    super('pending_action_not_found', 'Pending action not found');
  }
}

export class PendingActionExpiredError extends ConflictError {
  constructor() {
    super('pending_action_expired', 'This change expired; ask the assistant again');
  }
}

export class PendingActionClosedError extends ConflictError {
  constructor() {
    super('pending_action_closed', 'This change was already confirmed or cancelled');
  }
}

export class ActionNotAvailableError extends DomainError {
  constructor(message: string) {
    super('action_not_available', message, 501);
  }
}
