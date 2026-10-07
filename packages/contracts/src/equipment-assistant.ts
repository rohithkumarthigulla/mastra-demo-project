import { z } from 'zod';
import { calendarDateSchema, pageSchema, paginationQuery } from './common.js';

export const CHAT_MESSAGE_MAX = 4000;
export const CONVERSATION_TITLE_MAX = 120;

export const chatRoleSchema = z.enum(['USER', 'ASSISTANT']);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const createConversationSchema = z
  .object({ title: z.string().trim().min(1).max(CONVERSATION_TITLE_MAX).optional() })
  .strict();
export type CreateConversationRequest = z.infer<typeof createConversationSchema>;

export const sendChatMessageSchema = z
  .object({ content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX) })
  .strict();
export type SendChatMessageRequest = z.infer<typeof sendChatMessageSchema>;

export const listConversationsQuerySchema = z.object({ ...paginationQuery });
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

export const conversationSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ConversationDto = z.infer<typeof conversationSchema>;

export const conversationPageSchema = pageSchema(conversationSchema);
export type ConversationPageDto = z.infer<typeof conversationPageSchema>;

export const equipmentRecommendationSchema = z.object({
  modelId: z.uuid(),
  modelName: z.string(),
  manufacturerName: z.string(),
  reason: z.string(),
  activeListingCount: z.number().int(),
});
export type EquipmentRecommendationDto = z.infer<typeof equipmentRecommendationSchema>;

/** Prefill for `POST /requirements`; every field is a suggestion the builder can edit. */
export const draftRequirementSchema = z.object({
  title: z.string(),
  categoryCode: z.string(),
  equipmentModelId: z.uuid().nullable(),
  constructionTaskCode: z.string().nullable(),
  city: z.string().nullable(),
  startDate: calendarDateSchema.nullable(),
  endDate: calendarDateSchema.nullable(),
  quantity: z.number().int(),
  notes: z.string().nullable(),
});
export type DraftRequirementDto = z.infer<typeof draftRequirementSchema>;

export const assistantMessageSchema = z.object({
  id: z.uuid(),
  role: chatRoleSchema,
  content: z.string(),
  recommendedModelIds: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
});
export type AssistantMessageDto = z.infer<typeof assistantMessageSchema>;

export const assistantConversationDetailSchema = conversationSchema.extend({
  messages: z.array(assistantMessageSchema),
});
export type AssistantConversationDetailDto = z.infer<typeof assistantConversationDetailSchema>;

export const assistantReplySchema = z.object({
  message: assistantMessageSchema,
  recommendations: z.array(equipmentRecommendationSchema),
  draftRequirement: draftRequirementSchema.nullable(),
});
export type AssistantReplyDto = z.infer<typeof assistantReplySchema>;
