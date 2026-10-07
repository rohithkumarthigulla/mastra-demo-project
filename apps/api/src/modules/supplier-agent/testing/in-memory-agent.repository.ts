import { randomUUID } from 'node:crypto';
import type { PendingActionStatus } from '@ee/contracts';
import type {
  AgentRepository,
  NewAgentMessage,
  NewPendingAction,
  StoredAgentConversation,
  StoredAgentMessage,
  StoredPendingAction,
} from '../domain';

export class InMemoryAgentRepository implements AgentRepository {
  private readonly conversations: (StoredAgentConversation & { supplierProfileId: string })[] = [];
  private readonly messages: (StoredAgentMessage & { conversationId: string })[] = [];
  readonly actions: StoredPendingAction[] = [];

  createConversation(
    supplierProfileId: string,
    title: string,
    now: Date,
  ): Promise<StoredAgentConversation> {
    const row = { id: randomUUID(), supplierProfileId, title, createdAt: now, updatedAt: now };
    this.conversations.push(row);
    return Promise.resolve(strip(row));
  }

  listConversations(
    supplierProfileId: string,
    page: { limit: number; offset: number },
  ): Promise<{ items: StoredAgentConversation[]; total: number }> {
    const owned = this.conversations
      .filter((c) => c.supplierProfileId === supplierProfileId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));
    return Promise.resolve({
      items: owned.slice(page.offset, page.offset + page.limit).map(strip),
      total: owned.length,
    });
  }

  findConversation(supplierProfileId: string, id: string): Promise<StoredAgentConversation | null> {
    const row = this.conversations.find(
      (c) => c.id === id && c.supplierProfileId === supplierProfileId,
    );
    return Promise.resolve(row ? strip(row) : null);
  }

  renameConversation(id: string, title: string): Promise<void> {
    const row = this.conversations.find((c) => c.id === id);
    if (row) row.title = title;
    return Promise.resolve();
  }

  listMessages(conversationId: string): Promise<StoredAgentMessage[]> {
    return Promise.resolve(
      this.messages
        .filter((m) => m.conversationId === conversationId)
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citedDocumentIds: m.citedDocumentIds,
          createdAt: m.createdAt,
        })),
    );
  }

  addMessages(
    conversationId: string,
    messages: NewAgentMessage[],
    now: Date,
  ): Promise<StoredAgentMessage[]> {
    const rows = messages.map((m, i) => ({
      ...m,
      id: randomUUID(),
      createdAt: new Date(now.getTime() + i),
    }));
    this.messages.push(...rows.map((r) => ({ ...r, conversationId })));
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (conversation) conversation.updatedAt = now;
    return Promise.resolve(rows);
  }

  createAction(
    conversationId: string,
    action: NewPendingAction,
    now: Date,
  ): Promise<StoredPendingAction> {
    const row: StoredPendingAction = {
      ...action,
      id: randomUUID(),
      conversationId,
      status: 'PENDING',
      createdAt: now,
    };
    this.actions.push(row);
    return Promise.resolve({ ...row });
  }

  listActions(conversationId: string): Promise<StoredPendingAction[]> {
    return Promise.resolve(
      this.actions.filter((a) => a.conversationId === conversationId).map((a) => ({ ...a })),
    );
  }

  findAction(supplierProfileId: string, id: string): Promise<StoredPendingAction | null> {
    const action = this.actions.find((a) => a.id === id);
    const owned = this.conversations.some(
      (c) => c.id === action?.conversationId && c.supplierProfileId === supplierProfileId,
    );
    return Promise.resolve(action && owned ? { ...action } : null);
  }

  transitionAction(
    id: string,
    from: PendingActionStatus,
    to: PendingActionStatus,
    _now: Date,
    liveAt?: Date,
  ): Promise<boolean> {
    const action = this.actions.find((a) => a.id === id);
    if (!action || action.status !== from || (liveAt && action.expiresAt <= liveAt)) {
      return Promise.resolve(false);
    }
    action.status = to;
    return Promise.resolve(true);
  }
}

function strip(row: StoredAgentConversation): StoredAgentConversation {
  return { id: row.id, title: row.title, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
