import { randomUUID } from 'node:crypto';
import type { AssistantRepository, NewMessage, StoredConversation, StoredMessage } from '../domain';

export class InMemoryAssistantRepository implements AssistantRepository {
  private readonly conversations: StoredConversation[] = [];
  private readonly owners = new Map<string, string>();
  private readonly messages = new Map<string, StoredMessage[]>();

  async createConversation(builderAccountId: string, title: string, now: Date) {
    const row = { id: randomUUID(), title, createdAt: now, updatedAt: now };
    this.conversations.push(row);
    this.owners.set(row.id, builderAccountId);
    this.messages.set(row.id, []);
    return { ...row };
  }

  async listConversations(builderAccountId: string, page: { limit: number; offset: number }) {
    const owned = this.conversations
      .filter((c) => this.owners.get(c.id) === builderAccountId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return {
      items: owned.slice(page.offset, page.offset + page.limit).map((c) => ({ ...c })),
      total: owned.length,
    };
  }

  async findConversation(builderAccountId: string, id: string) {
    const row = this.conversations.find((c) => c.id === id);
    return row && this.owners.get(id) === builderAccountId ? { ...row } : null;
  }

  async renameConversation(id: string, title: string) {
    const conversation = this.conversations.find((c) => c.id === id);
    if (conversation) conversation.title = title;
  }

  async listMessages(conversationId: string) {
    return [...(this.messages.get(conversationId) ?? [])];
  }

  async addMessages(conversationId: string, messages: NewMessage[], now: Date) {
    const rows = messages.map((m, i) => ({
      ...m,
      id: randomUUID(),
      createdAt: new Date(now.getTime() + i),
    }));
    this.messages.get(conversationId)?.push(...rows);
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (conversation) conversation.updatedAt = now;
    return rows;
  }
}
