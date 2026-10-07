import { draftRequirementSchema, type DraftRequirementDto } from '@ee/contracts';
import { stringArg, type Tool } from '../../ai/application';
import type { EquipmentKnowledgeService } from '../../equipment-knowledge/application';
import type { EquipmentSpecification } from '../../equipment-knowledge/domain';
import type { EquipmentListingsService } from '../../equipment-listings/application';

const MAX_MODELS = 10;
const MAX_RECOMMENDATIONS = 5;

/** Everything the tools learned during one reply; the service builds its response from this. */
export class AssistantToolState {
  /** Models some tool actually returned — the only ones that may be recommended. */
  readonly knownModels = new Map<string, { modelName: string; manufacturerId: string }>();
  recommendation: { modelIds: string[]; reason: string } | null = null;
  draft: DraftRequirementDto | null = null;
}

interface Deps {
  knowledge: EquipmentKnowledgeService;
  listings: EquipmentListingsService;
}

export function assistantTools({ knowledge, listings }: Deps, state: AssistantToolState): Tool[] {
  const remember = (model: { id: string; modelName: string; manufacturerId: string }) => {
    state.knownModels.set(model.id, {
      modelName: model.modelName,
      manufacturerId: model.manufacturerId,
    });
    return { id: model.id, modelName: model.modelName };
  };

  return [
    {
      definition: {
        name: 'list_tasks',
        description: 'List the construction task codes the knowledge base knows about.',
        parameters: { type: 'object', properties: {} },
      },
      run: async () => ({
        tasks: (await knowledge.listConstructionTasks()).map((t) => ({
          code: t.code,
          name: t.displayName,
        })),
      }),
    },
    {
      definition: {
        name: 'get_task_requirements',
        description:
          'For a construction task code, list the capabilities it needs (with importance) and the equipment categories suited to it.',
        parameters: {
          type: 'object',
          properties: { taskCode: { type: 'string', description: 'e.g. FOUNDATION_EXCAVATION' } },
          required: ['taskCode'],
        },
      },
      run: async (args) => {
        const code = stringArg(args, 'taskCode')?.toUpperCase();
        const task = code ? await knowledge.findConstructionTaskByCode(code) : null;
        if (!task) return { error: 'Unknown task code. Call list_tasks for valid codes.' };
        const [capabilities, categories] = await Promise.all([
          knowledge.listTaskCapabilities(task.id),
          knowledge.listTaskCategories(task.id),
        ]);
        return {
          task: { code: task.code, name: task.displayName },
          capabilities: capabilities.map((c) => ({
            capability: { code: c.capability.code, name: c.capability.displayName },
            importance: c.importance,
          })),
          categories: categories.map((c) => ({
            category: { code: c.category.code, name: c.category.displayName },
            suitability: c.suitability,
          })),
        };
      },
    },
    {
      definition: {
        name: 'list_capability_models',
        description: 'List equipment models linked to a capability code.',
        parameters: {
          type: 'object',
          properties: { capabilityCode: { type: 'string', description: 'e.g. DEEP_EXCAVATION' } },
          required: ['capabilityCode'],
        },
      },
      run: async (args) => {
        const code = stringArg(args, 'capabilityCode')?.toUpperCase() ?? '';
        const links = await knowledge.listCapabilityModels(code);
        return {
          models: links
            .filter((l) => l.model.status === 'ACTIVE')
            .slice(0, MAX_MODELS)
            .map((l) => ({ model: remember(l.model), linkVerification: l.verificationStatus })),
        };
      },
    },
    {
      definition: {
        name: 'search_models',
        description: 'Search active equipment models by category code and/or model name text.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Category code, e.g. EXCAVATOR' },
            model: { type: 'string', description: 'Part of a model name' },
          },
        },
      },
      run: async (args) => {
        const page = await knowledge.searchModels({
          category: stringArg(args, 'category')?.toUpperCase(),
          model: stringArg(args, 'model'),
          spec: [],
          status: 'ACTIVE',
          limit: MAX_MODELS,
          offset: 0,
        });
        return { models: page.items.map((m) => ({ model: remember(m) })) };
      },
    },
    {
      definition: {
        name: 'get_model',
        description:
          'Read one model with its specifications and capabilities. Only quote specifications marked VERIFIED.',
        parameters: {
          type: 'object',
          properties: { modelId: { type: 'string', description: 'Model id' } },
          required: ['modelId'],
        },
      },
      run: async (args) => {
        const model = await knowledge.getModel(stringArg(args, 'modelId') ?? '');
        remember(model);
        return {
          model: { id: model.id, modelName: model.modelName },
          specifications: model.specifications.map(describeSpec),
          capabilities: model.capabilities.map((c) => ({
            code: c.capability.code,
            verification: c.verificationStatus,
          })),
        };
      },
    },
    {
      definition: {
        name: 'search_listings',
        description: 'Count and list active rental listings for a model, optionally in a city.',
        parameters: {
          type: 'object',
          properties: {
            modelId: { type: 'string', description: 'Model id' },
            city: { type: 'string', description: 'City geo id, e.g. IN-TG-HYD' },
          },
          required: ['modelId'],
        },
      },
      run: async (args) => {
        const page = await listings.browse({
          modelId: stringArg(args, 'modelId'),
          city: stringArg(args, 'city'),
          limit: 5,
          offset: 0,
        });
        return {
          total: page.total,
          listings: page.items.map((l) => ({
            id: l.id,
            title: l.title,
            city: l.city.name,
            pricePerDay: l.pricePerDay,
          })),
        };
      },
    },
    {
      definition: {
        name: 'recommend_models',
        description:
          'Record the models you recommend. Only ids returned by other tools in this conversation turn are accepted.',
        parameters: {
          type: 'object',
          properties: {
            modelIds: { type: 'string', description: 'Comma-separated model ids' },
            reason: { type: 'string', description: 'Why these models fit, from tool results only' },
          },
          required: ['modelIds', 'reason'],
        },
      },
      run: async (args) => {
        const requested = (stringArg(args, 'modelIds') ?? '').split(',').map((s) => s.trim());
        const accepted = [...new Set(requested)]
          .filter((id) => state.knownModels.has(id))
          .slice(0, MAX_RECOMMENDATIONS);
        const reason = stringArg(args, 'reason') ?? 'Matches the job requirements.';
        state.recommendation = { modelIds: accepted, reason };
        const rejected = requested.filter((id) => id && !accepted.includes(id));
        return { accepted, rejected };
      },
    },
    {
      definition: {
        name: 'draft_requirement',
        description:
          'Draft an equipment requirement once the job, category and dates are known. Dates are YYYY-MM-DD.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short title' },
            categoryCode: { type: 'string', description: 'Category code' },
            equipmentModelId: { type: 'string', description: 'Optional model id' },
            constructionTaskCode: { type: 'string', description: 'Optional task code' },
            cityGeoId: { type: 'string', description: 'Optional city geo id' },
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
            quantity: { type: 'integer', description: 'Number of machines' },
            notes: { type: 'string', description: 'Optional notes' },
          },
          required: ['title', 'categoryCode', 'startDate', 'endDate'],
        },
      },
      run: async (args) => {
        const modelId = stringArg(args, 'equipmentModelId');
        const parsed = draftRequirementSchema.safeParse({
          title: stringArg(args, 'title'),
          categoryCode: stringArg(args, 'categoryCode')?.toUpperCase(),
          equipmentModelId: modelId && state.knownModels.has(modelId) ? modelId : null,
          constructionTaskCode: stringArg(args, 'constructionTaskCode')?.toUpperCase() ?? null,
          cityGeoId: stringArg(args, 'cityGeoId') ?? null,
          startDate: stringArg(args, 'startDate') ?? null,
          endDate: stringArg(args, 'endDate') ?? null,
          quantity: Number(args.quantity ?? 1) || 1,
          notes: stringArg(args, 'notes') ?? null,
        });
        if (!parsed.success) return { error: 'The draft is incomplete or invalid.' };
        const draft = parsed.data;
        if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
          return { error: 'The end date is before the start date.' };
        }
        state.draft = draft;
        return { drafted: true };
      },
    },
  ];
}

/** Unverified values are labelled and unknown values hidden so the model cannot present them as fact. */
function describeSpec(spec: EquipmentSpecification) {
  if (spec.verificationStatus === 'UNKNOWN' || spec.verificationStatus === 'DEPRECATED') {
    return { code: spec.definitionCode, value: 'not known', verification: spec.verificationStatus };
  }
  return {
    code: spec.definitionCode,
    value: formatValue(spec),
    verification: spec.verificationStatus,
    ...(spec.verificationStatus === 'VERIFIED'
      ? {}
      : { note: 'unverified — do not quote as fact' }),
  };
}

function formatValue(spec: EquipmentSpecification): string {
  const unit = spec.unit ? ` ${spec.unit}` : '';
  if (spec.numericValue !== null) return `${spec.numericValue}${unit}`;
  if (spec.minValue !== null || spec.maxValue !== null) {
    return `${spec.minValue ?? '?'}–${spec.maxValue ?? '?'}${unit}`;
  }
  return spec.textValue || 'not known';
}
