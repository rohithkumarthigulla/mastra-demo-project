import { Inject, Injectable } from '@nestjs/common';
import {
  todayInRentalZone,
  type AssistantConversationDetailDto,
  type AssistantReplyDto,
  type ConversationDto,
  type ConversationPageDto,
  type CreateConversationRequest,
  type EquipmentRecommendationDto,
  type ListConversationsQuery,
} from '@ee/contracts';
import { CLOCK, type Clock } from '../../../platform/auth';
import { runToolLoop } from '../../ai/application';
import { AI_PROVIDER, type AiProvider, type ChatTurn } from '../../ai/domain';
import { EquipmentKnowledgeService } from '../../equipment-knowledge/application';
import { EquipmentListingsService } from '../../equipment-listings/application';
import {
  ASSISTANT_REPOSITORY,
  ConversationNotFoundError,
  type AssistantRepository,
  type StoredConversation,
  type StoredMessage,
} from '../domain';
import { assistantTools, AssistantToolState } from './assistant-tools';

const DEFAULT_TITLE = 'New conversation';
const TITLE_FROM_MESSAGE_MAX = 60;
/** Older turns add cost without helping much; the latest ones carry the job details. */
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `You help builders in India work out which construction equipment a job needs.
Rules:
- Answer only from tool results. Never invent models, specifications, capabilities or listings.
- Only state a specification as fact when its verification is VERIFIED. Say "unverified" for other values and "not known" when a value is missing.
- Use get_task_requirements (or list_tasks first) to map the job to capabilities and categories, then list_capability_models or search_models to find models.
- Record recommendations with recommend_models. Use search_listings to check availability when the builder gives a city.
- When the job, category and dates are known, call draft_requirement. If the job is too vague, ask one short follow-up question instead.
- Keep replies short and plain.`;

@Injectable()
export class EquipmentAssistantService {
  constructor(
    @Inject(ASSISTANT_REPOSITORY) private readonly repo: AssistantRepository,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly knowledge: EquipmentKnowledgeService,
    private readonly listings: EquipmentListingsService,
  ) {}

  async create(builderId: string, input: CreateConversationRequest): Promise<ConversationDto> {
    const row = await this.repo.createConversation(
      builderId,
      input.title ?? DEFAULT_TITLE,
      this.clock.now(),
    );
    return toConversation(row);
  }

  async list(builderId: string, query: ListConversationsQuery): Promise<ConversationPageDto> {
    const page = await this.repo.listConversations(builderId, query);
    return {
      ...page,
      items: page.items.map(toConversation),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async get(builderId: string, id: string): Promise<AssistantConversationDetailDto> {
    const conversation = await this.requireConversation(builderId, id);
    const messages = await this.repo.listMessages(id);
    return { ...toConversation(conversation), messages: messages.map(toMessage) };
  }

  async send(builderId: string, id: string, content: string): Promise<AssistantReplyDto> {
    const conversation = await this.requireConversation(builderId, id);
    const history = await this.repo.listMessages(id);
    const now = this.clock.now();

    const state = new AssistantToolState();
    const result = await runToolLoop(this.ai, {
      system: `${SYSTEM_PROMPT}\nToday is ${todayInRentalZone(now)}.`,
      history: [...history.slice(-HISTORY_LIMIT).map(toTurn), { role: 'user', text: content }],
      tools: assistantTools({ knowledge: this.knowledge, listings: this.listings }, state),
    });

    const recommendations = await this.recommendations(state);
    const text =
      result.text ||
      (recommendations.length > 0
        ? 'Here are the models that fit this job.'
        : 'Could you tell me more about the job?');

    const [, reply] = await this.repo.addMessages(
      id,
      [
        { role: 'USER', content, recommendedModelIds: [] },
        {
          role: 'ASSISTANT',
          content: text,
          recommendedModelIds: recommendations.map((r) => r.modelId),
        },
      ],
      now,
    );
    if (history.length === 0 && conversation.title === DEFAULT_TITLE) {
      // Titles are cosmetic; a fresh conversation takes its name from the first question.
      await this.repo.renameConversation(id, titleFrom(content));
    }
    return { message: toMessage(reply!), recommendations, draftRequirement: state.draft };
  }

  private async recommendations(state: AssistantToolState): Promise<EquipmentRecommendationDto[]> {
    if (!state.recommendation || state.recommendation.modelIds.length === 0) return [];
    const { modelIds, reason } = state.recommendation;
    const manufacturers = new Map(
      (await this.knowledge.listManufacturers()).map((m) => [m.id, m.name]),
    );
    return Promise.all(
      modelIds.map(async (modelId) => {
        const model = state.knownModels.get(modelId)!;
        const listings = await this.listings.browse({
          modelId,
          city: state.draft?.cityGeoId ?? undefined,
          limit: 1,
          offset: 0,
        });
        return {
          modelId,
          modelName: model.modelName,
          manufacturerName: manufacturers.get(model.manufacturerId) ?? 'Unknown manufacturer',
          reason,
          activeListingCount: listings.total,
        };
      }),
    );
  }

  private async requireConversation(builderId: string, id: string): Promise<StoredConversation> {
    const conversation = await this.repo.findConversation(builderId, id);
    if (!conversation) throw new ConversationNotFoundError();
    return conversation;
  }
}

function titleFrom(content: string): string {
  const line = content.split('\n')[0]!.trim();
  return line.length > TITLE_FROM_MESSAGE_MAX
    ? `${line.slice(0, TITLE_FROM_MESSAGE_MAX - 1)}…`
    : line || DEFAULT_TITLE;
}

function toTurn(message: StoredMessage): ChatTurn {
  return message.role === 'USER'
    ? { role: 'user', text: message.content }
    : { role: 'assistant', text: message.content };
}

function toConversation(row: StoredConversation): ConversationDto {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessage(row: StoredMessage) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    recommendedModelIds: row.recommendedModelIds,
    createdAt: row.createdAt.toISOString(),
  };
}
