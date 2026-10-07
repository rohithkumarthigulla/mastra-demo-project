import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import { assistantConversations, assistantMessages } from '../../../platform/database/schema';
import type { AssistantRepository, NewMessage, StoredConversation, StoredMessage } from '../domain';

const conversationColumns = {
  id: assistantConversations.id,
  title: assistantConversations.title,
  createdAt: assistantConversations.createdAt,
  updatedAt: assistantConversations.updatedAt,
};

const messageColumns = {
  id: assistantMessages.id,
  role: assistantMessages.role,
  content: assistantMessages.content,
  recommendedModelIds: assistantMessages.recommendedModelIds,
  createdAt: assistantMessages.createdAt,
};

@Injectable()
export class DrizzleAssistantRepository implements AssistantRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async createConversation(
    builderAccountId: string,
    title: string,
    now: Date,
  ): Promise<StoredConversation> {
    const [row] = await this.db
      .insert(assistantConversations)
      .values({ builderAccountId, title, createdAt: now, updatedAt: now })
      .returning(conversationColumns);
    return row!;
  }

  async listConversations(
    builderAccountId: string,
    page: { limit: number; offset: number },
  ): Promise<{ items: StoredConversation[]; total: number }> {
    const owned = eq(assistantConversations.builderAccountId, builderAccountId);
    const [items, [totals]] = await Promise.all([
      this.db
        .select(conversationColumns)
        .from(assistantConversations)
        .where(owned)
        .orderBy(desc(assistantConversations.updatedAt), desc(assistantConversations.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ total: count() }).from(assistantConversations).where(owned),
    ]);
    return { items, total: totals?.total ?? 0 };
  }

  async findConversation(builderAccountId: string, id: string): Promise<StoredConversation | null> {
    const [row] = await this.db
      .select(conversationColumns)
      .from(assistantConversations)
      .where(
        and(
          eq(assistantConversations.id, id),
          eq(assistantConversations.builderAccountId, builderAccountId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await this.db
      .update(assistantConversations)
      .set({ title })
      .where(eq(assistantConversations.id, id));
  }

  listMessages(conversationId: string): Promise<StoredMessage[]> {
    return this.db
      .select(messageColumns)
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, conversationId))
      .orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id));
  }

  addMessages(conversationId: string, messages: NewMessage[], now: Date): Promise<StoredMessage[]> {
    return this.db.transaction(async (tx) => {
      const rows: StoredMessage[] = [];
      // Distinct timestamps keep the order stable when several messages land in one request.
      for (const [i, message] of messages.entries()) {
        const [row] = await tx
          .insert(assistantMessages)
          .values({ ...message, conversationId, createdAt: new Date(now.getTime() + i) })
          .returning(messageColumns);
        rows.push(row!);
      }
      await tx
        .update(assistantConversations)
        .set({ updatedAt: now })
        .where(eq(assistantConversations.id, conversationId));
      return rows;
    });
  }
}
