import { Inject, Injectable } from '@nestjs/common';
import type { PendingActionStatus } from '@ee/contracts';
import { and, asc, count, desc, eq, gt } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import {
  agentConversations,
  agentMessages,
  agentPendingActions,
} from '../../../platform/database/schema';
import type {
  ActionPayload,
  AgentRepository,
  NewAgentMessage,
  NewPendingAction,
  StoredAgentConversation,
  StoredAgentMessage,
  StoredPendingAction,
} from '../domain';

const conversationColumns = {
  id: agentConversations.id,
  title: agentConversations.title,
  createdAt: agentConversations.createdAt,
  updatedAt: agentConversations.updatedAt,
};

const messageColumns = {
  id: agentMessages.id,
  role: agentMessages.role,
  content: agentMessages.content,
  citedDocumentIds: agentMessages.citedDocumentIds,
  createdAt: agentMessages.createdAt,
};

const actionColumns = {
  id: agentPendingActions.id,
  conversationId: agentPendingActions.conversationId,
  type: agentPendingActions.type,
  status: agentPendingActions.status,
  payload: agentPendingActions.payload,
  expiresAt: agentPendingActions.expiresAt,
  createdAt: agentPendingActions.createdAt,
};

type ActionRow = Omit<StoredPendingAction, 'payload'> & { payload: unknown };
const toAction = (row: ActionRow): StoredPendingAction => ({
  ...row,
  payload: row.payload as ActionPayload,
});

@Injectable()
export class DrizzleAgentRepository implements AgentRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async createConversation(
    supplierProfileId: string,
    title: string,
    now: Date,
  ): Promise<StoredAgentConversation> {
    const [row] = await this.db
      .insert(agentConversations)
      .values({ supplierProfileId, title, createdAt: now, updatedAt: now })
      .returning(conversationColumns);
    return row!;
  }

  async listConversations(
    supplierProfileId: string,
    page: { limit: number; offset: number },
  ): Promise<{ items: StoredAgentConversation[]; total: number }> {
    const owned = eq(agentConversations.supplierProfileId, supplierProfileId);
    const [items, [totals]] = await Promise.all([
      this.db
        .select(conversationColumns)
        .from(agentConversations)
        .where(owned)
        .orderBy(desc(agentConversations.updatedAt), desc(agentConversations.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ total: count() }).from(agentConversations).where(owned),
    ]);
    return { items, total: totals?.total ?? 0 };
  }

  async findConversation(
    supplierProfileId: string,
    id: string,
  ): Promise<StoredAgentConversation | null> {
    const [row] = await this.db
      .select(conversationColumns)
      .from(agentConversations)
      .where(
        and(
          eq(agentConversations.id, id),
          eq(agentConversations.supplierProfileId, supplierProfileId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await this.db.update(agentConversations).set({ title }).where(eq(agentConversations.id, id));
  }

  listMessages(conversationId: string): Promise<StoredAgentMessage[]> {
    return this.db
      .select(messageColumns)
      .from(agentMessages)
      .where(eq(agentMessages.conversationId, conversationId))
      .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));
  }

  addMessages(
    conversationId: string,
    messages: NewAgentMessage[],
    now: Date,
  ): Promise<StoredAgentMessage[]> {
    return this.db.transaction(async (tx) => {
      const rows: StoredAgentMessage[] = [];
      for (const [i, message] of messages.entries()) {
        const [row] = await tx
          .insert(agentMessages)
          .values({ ...message, conversationId, createdAt: new Date(now.getTime() + i) })
          .returning(messageColumns);
        rows.push(row!);
      }
      await tx
        .update(agentConversations)
        .set({ updatedAt: now })
        .where(eq(agentConversations.id, conversationId));
      return rows;
    });
  }

  async createAction(
    conversationId: string,
    action: NewPendingAction,
    now: Date,
  ): Promise<StoredPendingAction> {
    const [row] = await this.db
      .insert(agentPendingActions)
      .values({ ...action, conversationId, createdAt: now, updatedAt: now })
      .returning(actionColumns);
    return toAction(row!);
  }

  async listActions(conversationId: string): Promise<StoredPendingAction[]> {
    const rows = await this.db
      .select(actionColumns)
      .from(agentPendingActions)
      .where(eq(agentPendingActions.conversationId, conversationId))
      .orderBy(asc(agentPendingActions.createdAt), asc(agentPendingActions.id));
    return rows.map(toAction);
  }

  async findAction(supplierProfileId: string, id: string): Promise<StoredPendingAction | null> {
    const [row] = await this.db
      .select(actionColumns)
      .from(agentPendingActions)
      .innerJoin(agentConversations, eq(agentConversations.id, agentPendingActions.conversationId))
      .where(
        and(
          eq(agentPendingActions.id, id),
          eq(agentConversations.supplierProfileId, supplierProfileId),
        ),
      )
      .limit(1);
    return row ? toAction(row) : null;
  }

  async transitionAction(
    id: string,
    from: PendingActionStatus,
    to: PendingActionStatus,
    now: Date,
    liveAt?: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .update(agentPendingActions)
      .set({ status: to, updatedAt: now })
      .where(
        and(
          eq(agentPendingActions.id, id),
          eq(agentPendingActions.status, from),
          liveAt ? gt(agentPendingActions.expiresAt, liveAt) : undefined,
        ),
      )
      .returning({ id: agentPendingActions.id });
    return rows.length > 0;
  }
}
