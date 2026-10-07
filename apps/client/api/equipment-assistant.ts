import {
  assistantConversationDetailSchema,
  assistantReplySchema,
  conversationPageSchema,
  conversationSchema,
  type AssistantConversationDetailDto,
  type AssistantReplyDto,
  type ConversationDto,
  type ConversationPageDto,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type SendChatMessageRequest,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString, type ApiClient, type ApiRequest } from './client';

const id = encodeURIComponent;
const BASE = '/equipment-assistant/conversations';

export function createEquipmentAssistantApi(request: ApiRequest) {
  return {
    createConversation: (body: CreateConversationRequest = {}): Promise<ConversationDto> =>
      request(BASE, { method: 'POST', body, schema: conversationSchema }),
    listConversations: (
      query: Partial<ListConversationsQuery> = {},
    ): Promise<ConversationPageDto> =>
      request(`${BASE}${toQueryString(query)}`, { schema: conversationPageSchema }),
    getConversation: (conversationId: string): Promise<AssistantConversationDetailDto> =>
      request(`${BASE}/${id(conversationId)}`, { schema: assistantConversationDetailSchema }),
    sendMessage: (
      conversationId: string,
      body: SendChatMessageRequest,
    ): Promise<AssistantReplyDto> =>
      request(`${BASE}/${id(conversationId)}/messages`, {
        method: 'POST',
        body,
        schema: assistantReplySchema,
      }),
  };
}

export const equipmentAssistantKeys = {
  all: ['equipment-assistant'] as const,
  conversations: (query: Partial<ListConversationsQuery> = {}) =>
    ['equipment-assistant', 'conversations', query] as const,
  conversation: (conversationId: string) =>
    ['equipment-assistant', 'conversation', conversationId] as const,
};

function useInvalidateAssistant() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: equipmentAssistantKeys.all });
}

export function useAssistantConversations(
  api: ApiClient,
  query: Partial<ListConversationsQuery> = {},
) {
  return useQuery({
    queryKey: equipmentAssistantKeys.conversations(query),
    queryFn: () => api.equipmentAssistant.listConversations(query),
  });
}

export function useAssistantConversation(api: ApiClient, conversationId: string) {
  return useQuery({
    queryKey: equipmentAssistantKeys.conversation(conversationId),
    queryFn: () => api.equipmentAssistant.getConversation(conversationId),
  });
}

export function useCreateAssistantConversation(api: ApiClient) {
  const invalidate = useInvalidateAssistant();
  return useMutation({
    mutationFn: (body?: CreateConversationRequest) =>
      api.equipmentAssistant.createConversation(body),
    onSuccess: invalidate,
  });
}

export function useSendAssistantMessage(api: ApiClient) {
  const invalidate = useInvalidateAssistant();
  return useMutation({
    mutationFn: ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: SendChatMessageRequest;
    }) => api.equipmentAssistant.sendMessage(conversationId, body),
    onSuccess: invalidate,
  });
}
