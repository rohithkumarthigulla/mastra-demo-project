import { z } from 'zod';
import { conversationSchema, chatRoleSchema } from './equipment-assistant.js';

/** Dimensions of every `knowledge_chunks.embedding`. */
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 768;

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
});
export type AgentReplyDto = z.infer<typeof agentReplySchema>;
