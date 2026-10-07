import { Inject, Injectable } from '@nestjs/common';
import {
  todayInRentalZone,
  type AgentConversationDetailDto,
  type AgentMessageDto,
  type AgentReplyDto,
  type CitationDto,
  type ConversationDto,
  type ConversationPageDto,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type PendingActionDto,
} from '@ee/contracts';
import { CLOCK, type Clock } from '../../../platform/auth';
import { runToolLoop } from '../../ai/application';
import { AI_PROVIDER, type AiProvider, type ChatTurn } from '../../ai/domain';
import { AvailabilityService } from '../../availability/application';
import { EquipmentListingsService } from '../../equipment-listings/application';
import { FleetService } from '../../fleet/application';
import {
  ActionNotAvailableError,
  AGENT_REPOSITORY,
  AgentConversationNotFoundError,
  KNOWLEDGE_REPOSITORY,
  PENDING_ACTION_TTL_MS,
  PendingActionClosedError,
  PendingActionExpiredError,
  PendingActionNotFoundError,
  type AgentRepository,
  type KnowledgeRepository,
  type RetrievedChunk,
  type StoredAgentConversation,
  type StoredAgentMessage,
  type StoredPendingAction,
} from '../domain';
import { agentTools, AgentToolState } from './agent-tools';

const DEFAULT_TITLE = 'New conversation';
const TITLE_FROM_MESSAGE_MAX = 60;
const HISTORY_LIMIT = 20;
const RETRIEVED_CHUNKS = 4;
const SUPPLIER_AUDIENCES = ['SUPPLIER', 'ALL'];

const SYSTEM_PROMPT = `You help equipment suppliers in India run their rental business on the platform.
Rules:
- Answer how-to questions only from the platform guide excerpts below. If they do not cover it, say so.
- Use the read tools to look at the supplier's own machines, yards, listings and availability. Never guess ids, dates or prices.
- You cannot change anything yourself. To change something, call one propose_* tool; the supplier then confirms or cancels it.
- Keep replies short and plain.`;

@Injectable()
export class SupplierAgentService {
  constructor(
    @Inject(AGENT_REPOSITORY) private readonly repo: AgentRepository,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly knowledge: KnowledgeRepository,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly fleet: FleetService,
    private readonly availability: AvailabilityService,
    private readonly listings: EquipmentListingsService,
  ) {}

  async create(accountId: string, input: CreateConversationRequest): Promise<ConversationDto> {
    const profileId = await this.fleet.requireProfile(accountId);
    const row = await this.repo.createConversation(
      profileId,
      input.title ?? DEFAULT_TITLE,
      this.clock.now(),
    );
    return toConversation(row);
  }

  async list(accountId: string, query: ListConversationsQuery): Promise<ConversationPageDto> {
    const profileId = await this.fleet.requireProfile(accountId);
    const page = await this.repo.listConversations(profileId, query);
    return {
      items: page.items.map(toConversation),
      total: page.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async get(accountId: string, id: string): Promise<AgentConversationDetailDto> {
    const conversation = await this.requireConversation(accountId, id);
    const [messages, actions] = await Promise.all([
      this.repo.listMessages(id),
      this.repo.listActions(id),
    ]);
    const now = this.clock.now();
    return {
      ...toConversation(conversation),
      messages: messages.map(toMessage),
      pendingActions: actions.map((a) => toAction(a, now)),
    };
  }

  async send(accountId: string, id: string, content: string): Promise<AgentReplyDto> {
    const conversation = await this.requireConversation(accountId, id);
    const history = await this.repo.listMessages(id);
    const now = this.clock.now();

    const [queryEmbedding] = await this.ai.embed([content], 'query');
    const chunks = await this.knowledge.searchChunks(
      queryEmbedding!,
      SUPPLIER_AUDIENCES,
      RETRIEVED_CHUNKS,
    );

    const state = new AgentToolState();
    const result = await runToolLoop(this.ai, {
      system: `${SYSTEM_PROMPT}\nToday is ${todayInRentalZone(now)}.\n\nPlatform guide excerpts:\n${excerpts(chunks)}`,
      history: [...history.slice(-HISTORY_LIMIT).map(toTurn), { role: 'user', text: content }],
      tools: agentTools(
        {
          accountId,
          now,
          fleet: this.fleet,
          availability: this.availability,
          listings: this.listings,
        },
        state,
      ),
    });

    const citations = state.proposal ? [] : citationsFrom(chunks);
    const action = state.proposal
      ? await this.repo.createAction(
          id,
          {
            type: state.proposal.type,
            payload: state.proposal.payload,
            expiresAt: new Date(now.getTime() + PENDING_ACTION_TTL_MS),
          },
          now,
        )
      : null;
    const text =
      result.text ||
      (action
        ? `Please confirm: ${action.payload.summary}`
        : 'I could not find that in the platform guides.');

    const [, reply] = await this.repo.addMessages(
      id,
      [
        { role: 'USER', content, citedDocumentIds: [] },
        { role: 'ASSISTANT', content: text, citedDocumentIds: citations.map((c) => c.documentId) },
      ],
      now,
    );
    if (history.length === 0 && conversation.title === DEFAULT_TITLE) {
      await this.repo.renameConversation(id, titleFrom(content));
    }
    return {
      message: toMessage(reply!),
      citations,
      pendingAction: action ? toAction(action, now) : null,
    };
  }

  /**
   * Claims the action atomically (PENDING and unexpired → CONFIRMED) so it runs at most once,
   * then applies it through the owning module's service with the supplier's own permissions.
   */
  async confirm(accountId: string, id: string): Promise<PendingActionDto> {
    const action = await this.requireAction(accountId, id);
    const now = this.clock.now();
    await this.assertOpen(action, now);
    if (!(await this.repo.transitionAction(id, 'PENDING', 'CONFIRMED', now, now))) {
      // Another request confirmed, cancelled or expired it in the meantime.
      throw new PendingActionClosedError();
    }

    try {
      await this.execute(accountId, action);
    } catch (error) {
      // Not-yet-available actions stay confirmed (the supplier did confirm); real failures
      // reopen the action so the supplier can fix the cause and try again before it expires.
      if (!(error instanceof ActionNotAvailableError)) {
        await this.repo.transitionAction(id, 'CONFIRMED', 'PENDING', this.clock.now());
      }
      throw error;
    }
    return toAction({ ...action, status: 'CONFIRMED' }, now);
  }

  async cancel(accountId: string, id: string): Promise<PendingActionDto> {
    const action = await this.requireAction(accountId, id);
    const now = this.clock.now();
    await this.assertOpen(action, now);
    if (!(await this.repo.transitionAction(id, 'PENDING', 'CANCELLED', now))) {
      throw new PendingActionClosedError();
    }
    return toAction({ ...action, status: 'CANCELLED' }, now);
  }

  private async execute(accountId: string, action: StoredPendingAction): Promise<void> {
    const args = action.payload.args;
    switch (action.type) {
      case 'BLOCK_UNIT':
        await this.availability.createBlock(accountId, String(args.unitId), {
          reason: args.reason as 'MAINTENANCE' | 'TRANSPORT' | 'HELD_BACK',
          startAt: String(args.startAt),
          endAt: String(args.endAt),
          note: 'Added by the assistant after confirmation',
        });
        return;
      case 'LIFT_BLOCK':
        await this.availability.liftBlock(accountId, String(args.blockId));
        return;
      case 'UPDATE_LISTING_PRICE':
        await this.listings.update(accountId, String(args.listingId), {
          pricePerDay: Number(args.pricePerDay),
        });
        return;
      case 'REJECT_REQUEST':
        throw new ActionNotAvailableError(
          'Rejecting rental requests through the assistant is not available yet.',
        );
    }
  }

  private async assertOpen(action: StoredPendingAction, now: Date): Promise<void> {
    if (action.status !== 'PENDING') throw new PendingActionClosedError();
    if (action.expiresAt <= now) {
      await this.repo.transitionAction(action.id, 'PENDING', 'EXPIRED', now);
      throw new PendingActionExpiredError();
    }
  }

  private async requireConversation(
    accountId: string,
    id: string,
  ): Promise<StoredAgentConversation> {
    const profileId = await this.fleet.requireProfile(accountId);
    const conversation = await this.repo.findConversation(profileId, id);
    if (!conversation) throw new AgentConversationNotFoundError();
    return conversation;
  }

  private async requireAction(accountId: string, id: string): Promise<StoredPendingAction> {
    const profileId = await this.fleet.requireProfile(accountId);
    const action = await this.repo.findAction(profileId, id);
    if (!action) throw new PendingActionNotFoundError();
    return action;
  }
}

/** Chunks start with the document title heading; the prompt shows it in the source line instead. */
function excerpts(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '(none found)';
  return chunks
    .map(
      (c, i) =>
        `[source ${i + 1}] ${c.title} (${c.topic})\n${c.content.replace(/^#\s+.+\n+/, '').trim()}`,
    )
    .join('\n\n');
}

function citationsFrom(chunks: RetrievedChunk[]): CitationDto[] {
  const seen = new Map<string, CitationDto>();
  for (const c of chunks) {
    if (!seen.has(c.documentId)) {
      seen.set(c.documentId, { documentId: c.documentId, title: c.title, topic: c.topic });
    }
  }
  return [...seen.values()];
}

function titleFrom(content: string): string {
  const line = content.split('\n')[0]!.trim();
  return line.length > TITLE_FROM_MESSAGE_MAX
    ? `${line.slice(0, TITLE_FROM_MESSAGE_MAX - 1)}…`
    : line || DEFAULT_TITLE;
}

function toTurn(message: StoredAgentMessage): ChatTurn {
  return message.role === 'USER'
    ? { role: 'user', text: message.content }
    : { role: 'assistant', text: message.content };
}

function toConversation(row: StoredAgentConversation): ConversationDto {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessage(row: StoredAgentMessage): AgentMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citedDocumentIds: row.citedDocumentIds,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A pending action past its expiry reads as EXPIRED even before anything marks it so. */
function toAction(row: StoredPendingAction, now: Date): PendingActionDto {
  return {
    id: row.id,
    type: row.type,
    status: row.status === 'PENDING' && row.expiresAt <= now ? 'EXPIRED' : row.status,
    summary: row.payload.summary,
    expiresAt: row.expiresAt.toISOString(),
  };
}
