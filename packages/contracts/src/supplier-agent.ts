import { z } from 'zod';
import { CHAT_MESSAGE_MAX, conversationSchema, chatRoleSchema } from './equipment-assistant.js';

/** Dimensions of every `knowledge_chunks.embedding`. */
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 768;

/** Letters of each script the agent understands. */
const SCRIPT_LETTERS = {
  Latin: /[A-Za-z]/gu,
  Devanagari: /[\u0900-\u097F]/gu,
  Bengali: /[\u0980-\u09FF]/gu,
  Tamil: /[\u0B80-\u0BFF]/gu,
  Telugu: /[\u0C00-\u0C7F]/gu,
  Kannada: /[\u0C80-\u0CFF]/gu,
  Malayalam: /[\u0D00-\u0D7F]/gu,
} as const;
export type Script = keyof typeof SCRIPT_LETTERS;

/**
 * Languages the supplier agent speaks. Adding a language is one row here (and its script in
 * `SCRIPT_LETTERS` if new). When several languages share a script, typed text in that script
 * resolves to the first one listed.
 */
export const AGENT_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', script: 'Latin', speechCode: 'en-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', script: 'Devanagari', speechCode: 'hi-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', script: 'Devanagari', speechCode: 'mr-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu', speechCode: 'te-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil', speechCode: 'ta-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada', speechCode: 'kn-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam', speechCode: 'ml-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', script: 'Bengali', speechCode: 'bn-IN' },
] as const satisfies readonly {
  code: string;
  name: string;
  nativeName: string;
  script: Script;
  speechCode: string;
}[];

export type AgentLanguageInfo = (typeof AGENT_LANGUAGES)[number];
export const agentLanguageSchema = z.enum(
  AGENT_LANGUAGES.map((l) => l.code) as [AgentLanguageInfo['code'], ...AgentLanguageInfo['code'][]],
);
export type AgentLanguage = z.infer<typeof agentLanguageSchema>;
export const DEFAULT_AGENT_LANGUAGE: AgentLanguage = 'en';

export function agentLanguage(code: AgentLanguage): AgentLanguageInfo {
  return AGENT_LANGUAGES.find((l) => l.code === code)!;
}

/** Maps a speech code such as `hi-IN` (or `hi`) back to a supported language. */
export function agentLanguageFromSpeechCode(code: string | null | undefined): AgentLanguage | null {
  if (!code) return null;
  const lower = code.toLowerCase();
  const match = AGENT_LANGUAGES.find(
    (l) => l.speechCode.toLowerCase() === lower || l.code === lower.split('-')[0],
  );
  return match?.code ?? null;
}

/** The script with the most letters in `text`, or null when it has no letters. */
export function scriptOf(text: string): Script | null {
  let best: Script | null = null;
  let bestCount = 0;
  for (const [script, letters] of Object.entries(SCRIPT_LETTERS) as [Script, RegExp][]) {
    const count = text.match(letters)?.length ?? 0;
    if (count > bestCount) {
      best = script;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The reply language: the language the speech provider detected, otherwise the script of
 * the typed text, otherwise the picker. A candidate in the same script as the picker (Hindi
 * and Marathi) yields to the picker; a different script always wins over it.
 */
export function resolveReplyLanguage(input: {
  spoken?: AgentLanguage | null;
  text: string;
  selected: AgentLanguage;
}): AgentLanguage {
  const script = scriptOf(input.text);
  const candidate = input.spoken ?? AGENT_LANGUAGES.find((l) => l.script === script)?.code ?? null;
  if (!candidate) return input.selected;
  if (agentLanguage(candidate).script === agentLanguage(input.selected).script) {
    return input.selected;
  }
  return candidate;
}

export const sendAgentMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
    /** The language picker on this device. */
    language: agentLanguageSchema.optional(),
    /** The language the speech provider detected, when the message was spoken. */
    spokenLanguage: agentLanguageSchema.optional(),
  })
  .strict();
export type SendAgentMessageRequest = z.infer<typeof sendAgentMessageSchema>;

/** What the agent is doing while a message is being answered; never a tool name. */
export const agentActivitySchema = z.enum([
  'READING_GUIDES',
  'CHECKING_FLEET',
  'CHECKING_AVAILABILITY',
  'CHECKING_LISTINGS',
  'CHECKING_REQUESTS',
  'PREPARING_CHANGE',
]);
export type AgentActivity = z.infer<typeof agentActivitySchema>;

export const agentProgressSchema = z.object({ activity: agentActivitySchema.nullable() });
export type AgentProgressDto = z.infer<typeof agentProgressSchema>;

/** Voice is offered only when the server has a speech provider configured. */
export const speechStatusSchema = z.object({ enabled: z.boolean() });
export type SpeechStatusDto = z.infer<typeof speechStatusSchema>;

/** `POST /supplier-agent/speech/transcribe` takes one audio file (multipart) and this query. */
export const transcribeQuerySchema = z
  .object({ language: agentLanguageSchema.optional() })
  .strict();
export type TranscribeQuery = z.infer<typeof transcribeQuerySchema>;

export const transcriptionSchema = z.object({
  text: z.string(),
  language: agentLanguageSchema.nullable(),
});
export type TranscriptionDto = z.infer<typeof transcriptionSchema>;

export const SPEECH_TEXT_MAX = 500;
/** `GET /supplier-agent/speech/audio` answers `audio/wav` bytes. */
export const synthesizeQuerySchema = z
  .object({
    text: z.string().trim().min(1).max(SPEECH_TEXT_MAX),
    language: agentLanguageSchema,
  })
  .strict();
export type SynthesizeQuery = z.infer<typeof synthesizeQuerySchema>;

export const pendingActionTypeSchema = z.enum([
  'BLOCK_UNIT',
  'LIFT_BLOCK',
  'UPDATE_LISTING_PRICE',
  'REJECT_REQUEST',
]);
export type PendingActionType = z.infer<typeof pendingActionTypeSchema>;

export const pendingActionStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']);
export type PendingActionStatus = z.infer<typeof pendingActionStatusSchema>;

export const citationSchema = z.object({
  documentId: z.uuid(),
  title: z.string(),
  topic: z.string(),
});
export type CitationDto = z.infer<typeof citationSchema>;

export const pendingActionSchema = z.object({
  id: z.uuid(),
  type: pendingActionTypeSchema,
  status: pendingActionStatusSchema,
  /** Plain-language description of what confirming will change. */
  summary: z.string(),
  expiresAt: z.iso.datetime(),
});
export type PendingActionDto = z.infer<typeof pendingActionSchema>;

export const agentMessageSchema = z.object({
  id: z.uuid(),
  role: chatRoleSchema,
  content: z.string(),
  citedDocumentIds: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
});
export type AgentMessageDto = z.infer<typeof agentMessageSchema>;

export const agentConversationDetailSchema = conversationSchema.extend({
  messages: z.array(agentMessageSchema),
  pendingActions: z.array(pendingActionSchema),
});
export type AgentConversationDetailDto = z.infer<typeof agentConversationDetailSchema>;

export const agentReplySchema = z.object({
  message: agentMessageSchema,
  citations: z.array(citationSchema),
  pendingAction: pendingActionSchema.nullable(),
  /** The language the reply (and any pending action summary) is written in. */
  language: agentLanguageSchema,
});
export type AgentReplyDto = z.infer<typeof agentReplySchema>;
