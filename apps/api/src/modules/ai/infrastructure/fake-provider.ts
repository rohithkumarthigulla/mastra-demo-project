import {
  EMBEDDING_DIMENSIONS,
  type AiProvider,
  type ChatRequest,
  type ChatResponse,
  type ChatTurn,
  type ToolCall,
} from '../domain';
import { normalize } from './vector';

/**
 * Deterministic stand-in for tests and keyless local runs. Embeddings are hashed bags of
 * words, so texts that share words are close. Chat follows small keyword scripts over the
 * tools it is offered and only ever answers from tool results. Instead of translating, it
 * tags non-English replies with the language code (`[hi] …`).
 */
export class FakeProvider implements AiProvider {
  readonly embeddingModel = 'fake-hash-768';

  embed(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(fakeEmbedding));
  }

  chat(request: ChatRequest): Promise<ChatResponse> {
    const offered = new Set(request.tools.map((t) => t.name));
    const { userText, calls } = currentRound(request.messages);
    const ctx: ScriptContext = {
      text: userText.toLowerCase(),
      raw: userText,
      today: todayFrom(request.system),
      calls,
      called: (name) => calls.some((c) => c.name === name),
      result: (name) => [...calls].reverse().find((c) => c.name === name)?.result,
    };
    for (const step of SCRIPT) {
      if (!offered.has(step.tool) || ctx.called(step.tool)) continue;
      const args = step.when(ctx);
      if (args) return Promise.resolve({ text: '', toolCalls: [{ name: step.tool, args }] });
    }
    const language = /Reply language: ([a-z]{2})\./.exec(request.system)?.[1] ?? 'en';
    if (request.system.startsWith('Translate ')) {
      return Promise.resolve({ text: `[${language}] ${userText}`, toolCalls: [] });
    }
    const text = finalText(ctx, request);
    return Promise.resolve({
      text: language === 'en' ? text : `[${language}] ${text}`,
      toolCalls: [],
    });
  }
}

export function fakeEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  let words = 0;
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (word.length < 3) continue;
    const slot = hash(stem(word)) % EMBEDDING_DIMENSIONS;
    vector[slot] = (vector[slot] ?? 0) + 1;
    words++;
  }
  if (words === 0) vector[0] = 1;
  return normalize(vector);
}

function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, '');
}

function hash(word: string): number {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface RoundCall extends ToolCall {
  result: unknown;
}

interface ScriptContext {
  text: string;
  raw: string;
  today: string | null;
  calls: RoundCall[];
  called(name: string): boolean;
  result(name: string): unknown;
}

interface Step {
  tool: string;
  when(ctx: ScriptContext): Record<string, unknown> | null;
}

/** The latest user message and the tool calls made since it. */
function currentRound(turns: ChatTurn[]): { userText: string; calls: RoundCall[] } {
  let start = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]?.role === 'user') {
      start = i;
      break;
    }
  }
  const first = turns[start];
  const userText = first?.role === 'user' ? first.text : '';
  const calls: RoundCall[] = [];
  for (const turn of turns.slice(start + 1)) {
    if (turn.role === 'assistant') {
      for (const call of turn.toolCalls ?? []) calls.push({ ...call, result: undefined });
    } else if (turn.role === 'tool') {
      const pending = calls.find((c) => c.name === turn.name && c.result === undefined);
      if (pending) pending.result = turn.result;
    }
  }
  return { userText, calls };
}

function todayFrom(system: string): string | null {
  return /Today is (\d{4}-\d{2}-\d{2})/.exec(system)?.[1] ?? null;
}

const TASK_KEYWORDS: [RegExp, string][] = [
  [/foundation/, 'FOUNDATION_EXCAVATION'],
  [/trench/, 'TRENCH_DIGGING'],
  [/grading|level/, 'SITE_GRADING'],
  [/compact/, 'SOIL_COMPACTION'],
  [/demoli/, 'DEMOLITION_WORK'],
  [/loading|load /, 'MATERIAL_LOADING'],
  [/lift/, 'HEAVY_LIFTING'],
  [/haul/, 'EARTH_HAULING'],
  [/utility|pipe|cable/, 'UTILITY_INSTALLATION'],
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;

function taskCode(text: string): string | null {
  return TASK_KEYWORDS.find(([re]) => re.test(text))?.[1] ?? null;
}

interface CapabilityRow {
  capability: { code: string };
  importance: string;
}
interface ModelRow {
  model: { id: string; modelName: string };
}

function requiredCapability(ctx: ScriptContext): string | null {
  const reqs = ctx.result('get_task_requirements') as
    { capabilities?: CapabilityRow[] } | undefined;
  return reqs?.capabilities?.find((c) => c.importance === 'REQUIRED')?.capability.code ?? null;
}

function capabilityModels(ctx: ScriptContext): ModelRow[] {
  const rows = ctx.result('list_capability_models') as { models?: ModelRow[] } | undefined;
  return rows?.models ?? [];
}

function dateRange(ctx: ScriptContext): { startDate: string; endDate: string } | null {
  const dates = ctx.raw.match(ISO_DATE);
  if (dates && dates.length >= 1) return { startDate: dates[0], endDate: dates[1] ?? dates[0] };
  if (ctx.today && /next week/.test(ctx.text)) {
    const today = new Date(`${ctx.today}T00:00:00Z`);
    const daysToMonday = (8 - today.getUTCDay()) % 7 || 7;
    const monday = new Date(today.getTime() + daysToMonday * 86_400_000);
    const sunday = new Date(monday.getTime() + 6 * 86_400_000);
    return { startDate: iso(monday), endDate: iso(sunday) };
  }
  return null;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface NamedRow {
  id: string;
  label?: string | null;
  title?: string;
  model?: { modelName: string };
}

function pickByName<T extends NamedRow>(ctx: ScriptContext, rows: T[]): T | undefined {
  const id = UUID.exec(ctx.raw)?.[0]?.toLowerCase();
  if (id) return rows.find((r) => r.id === id);
  const names = (r: T) =>
    [r.label, r.title, r.model?.modelName]
      .filter((n): n is string => !!n)
      .map((n) => n.toLowerCase());
  return rows.find((r) => names(r).some((n) => ctx.text.includes(n))) ?? rows[0];
}

const SCRIPT: Step[] = [
  // Builder equipment assistant.
  {
    tool: 'get_task_requirements',
    when: (ctx) => {
      const code = taskCode(ctx.text);
      return code ? { taskCode: code } : null;
    },
  },
  {
    tool: 'list_capability_models',
    when: (ctx) => {
      const code = requiredCapability(ctx);
      return code ? { capabilityCode: code } : null;
    },
  },
  {
    tool: 'get_model',
    when: (ctx) => {
      const first = capabilityModels(ctx)[0];
      return first ? { modelId: first.model.id } : null;
    },
  },
  {
    tool: 'recommend_models',
    when: (ctx) => {
      const capability = requiredCapability(ctx);
      const models = capabilityModels(ctx);
      if (!capability || models.length === 0) return null;
      return {
        modelIds: models
          .slice(0, 3)
          .map((m) => m.model.id)
          .join(','),
        reason: `Linked to the ${capability} capability this job requires.`,
      };
    },
  },
  {
    tool: 'draft_requirement',
    when: (ctx) => {
      const code = taskCode(ctx.text);
      const range = ctx.raw.match(ISO_DATE);
      const model = capabilityModels(ctx)[0];
      const reqs = ctx.result('get_task_requirements') as
        { categories?: { category: { code: string }; suitability: string }[] } | undefined;
      const category = reqs?.categories?.find((c) => c.suitability === 'PRIMARY')?.category.code;
      if (!code || !range || !category) return null;
      return {
        title: `${code.toLowerCase().replace(/_/g, ' ')} job`,
        categoryCode: category,
        equipmentModelId: model?.model.id ?? null,
        constructionTaskCode: code,
        startDate: range[0],
        endDate: range[1] ?? range[0],
        quantity: 1,
      };
    },
  },
  // Supplier agent.
  {
    tool: 'list_units',
    when: (ctx) =>
      /\b(block|machine|unit|fleet)/.test(ctx.text) && !/lift/.test(ctx.text) ? {} : null,
  },
  {
    tool: 'propose_block_unit',
    when: (ctx) => {
      if (!/\bblock\b/.test(ctx.text) || /lift/.test(ctx.text)) return null;
      const units = (ctx.result('list_units') as { units?: NamedRow[] } | undefined)?.units ?? [];
      const unit = pickByName(ctx, units);
      const range = dateRange(ctx);
      if (!unit || !range) return null;
      const reason = /maint|service|repair/.test(ctx.text)
        ? 'MAINTENANCE'
        : /transport|move/.test(ctx.text)
          ? 'TRANSPORT'
          : 'HELD_BACK';
      return { unitId: unit.id, ...range, reason };
    },
  },
  {
    tool: 'propose_lift_block',
    when: (ctx) => {
      const id = UUID.exec(ctx.raw)?.[0];
      return /lift/.test(ctx.text) && /block/.test(ctx.text) && id ? { blockId: id } : null;
    },
  },
  {
    tool: 'list_listings',
    when: (ctx) => (/listing|price|rate/.test(ctx.text) ? {} : null),
  },
  {
    tool: 'propose_listing_price',
    when: (ctx) => {
      if (!/price|rate/.test(ctx.text)) return null;
      const amount = /(?:₹|rs\.?|inr|to)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(ctx.raw)?.[1];
      const listings =
        (ctx.result('list_listings') as { listings?: NamedRow[] } | undefined)?.listings ?? [];
      const listing = pickByName(ctx, listings);
      if (!amount || !listing) return null;
      return { listingId: listing.id, pricePerDay: Number(amount.replace(/,/g, '')) };
    },
  },
  {
    tool: 'list_rental_requests',
    when: (ctx) => (/\b(reject|decline|requests?)\b/.test(ctx.text) ? {} : null),
  },
  {
    tool: 'propose_reject_request',
    when: (ctx) => {
      if (!/reject|decline/.test(ctx.text)) return null;
      const id = UUID.exec(ctx.raw)?.[0];
      const requests =
        (ctx.result('list_rental_requests') as { requests?: { id: string; builder: string }[] })
          ?.requests ?? [];
      const match = id ? { id } : requests.find((r) => ctx.text.includes(r.builder.toLowerCase()));
      if (!match) return null;
      const reason = /because (.+?)[.!]?$/i.exec(ctx.raw)?.[1];
      return reason ? { requestId: match.id, reason } : { requestId: match.id };
    },
  },
];

function finalText(ctx: ScriptContext, request: ChatRequest): string {
  const offered = new Set(request.tools.map((t) => t.name));
  if (offered.has('get_task_requirements')) {
    const recommended = ctx.calls.find((c) => c.name === 'recommend_models');
    if (!recommended) {
      return 'Could you tell me more about the job — what work is being done, roughly how big it is, and where?';
    }
    const names = capabilityModels(ctx)
      .slice(0, 3)
      .map((m) => m.model.modelName)
      .join(', ');
    return `From the equipment knowledge base, these models suit this job: ${names}. Specifications that are not verified are not quoted.`;
  }
  const proposal = ctx.calls.find((c) => c.name.startsWith('propose_'));
  if (proposal) {
    const result = proposal.result as { summary?: string; error?: string } | undefined;
    if (result?.error) return `I could not prepare that change: ${result.error}`;
    return `I have prepared this change for you to confirm: ${result?.summary ?? ''}`.trim();
  }
  const source = /\[source \d+\][^\n]*\n([^\n]+)/.exec(request.system)?.[1];
  if (source) return `According to the platform guides: ${source.trim()}`;
  return 'I could not find that in the platform guides.';
}
