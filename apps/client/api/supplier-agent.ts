import {
  agentConversationDetailSchema,
  agentReplySchema,
  conversationPageSchema,
  conversationSchema,
  pendingActionSchema,
  type AgentConversationDetailDto,
  type AgentReplyDto,
  type ConversationDto,
  type ConversationPageDto,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type PendingActionDto,
  type SendChatMessageRequest,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString, type ApiClient, type ApiRequest } from './client';

const id = encodeURIComponent;
const BASE = '/supplier-agent';

export function createSupplierAgentApi(request: ApiRequest) {
  return {
    createConversation: (body: CreateConversationRequest = {}): Promise<ConversationDto> =>
      request(`${BASE}/conversations`, { method: 'POST', body, schema: conversationSchema }),
    listConversations: (
      query: Partial<ListConversationsQuery> = {},
    ): Promise<ConversationPageDto> =>
      request(`${BASE}/conversations${toQueryString(query)}`, { schema: conversationPageSchema }),
    getConversation: (conversationId: string): Promise<AgentConversationDetailDto> =>
      request(`${BASE}/conversations/${id(conversationId)}`, {
        schema: agentConversationDetailSchema,
      }),
    sendMessage: (conversationId: string, body: SendChatMessageRequest): Promise<AgentReplyDto> =>
      request(`${BASE}/conversations/${id(conversationId)}/messages`, {
        method: 'POST',
        body,
        schema: agentReplySchema,
      }),
    confirmAction: (actionId: string): Promise<PendingActionDto> =>
      request(`${BASE}/actions/${id(actionId)}/confirm`, {
        method: 'POST',
        schema: pendingActionSchema,
      }),
    cancelAction: (actionId: string): Promise<PendingActionDto> =>
      request(`${BASE}/actions/${id(actionId)}/cancel`, {
        method: 'POST',
        schema: pendingActionSchema,
      }),
  };
}

export const supplierAgentKeys = {
  all: ['supplier-agent'] as const,
  conversations: (query: Partial<ListConversationsQuery> = {}) =>
    ['supplier-agent', 'conversations', query] as const,
  conversation: (conversationId: string) =>
    ['supplier-agent', 'conversation', conversationId] as const,
};

function useInvalidateAgent() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: supplierAgentKeys.all });
}

export function useAgentConversations(api: ApiClient, query: Partial<ListConversationsQuery> = {}) {
  return useQuery({
    queryKey: supplierAgentKeys.conversations(query),
    queryFn: () => api.supplierAgent.listConversations(query),
  });
}

export function useAgentConversation(api: ApiClient, conversationId: string) {
  return useQuery({
    queryKey: supplierAgentKeys.conversation(conversationId),
    queryFn: () => api.supplierAgent.getConversation(conversationId),
  });
}

export function useCreateAgentConversation(api: ApiClient) {
  const invalidate = useInvalidateAgent();
  return useMutation({
    mutationFn: (body?: CreateConversationRequest) => api.supplierAgent.createConversation(body),
    onSuccess: invalidate,
  });
}

export function useSendAgentMessage(api: ApiClient) {
  const invalidate = useInvalidateAgent();
  return useMutation({
    mutationFn: ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: SendChatMessageRequest;
    }) => api.supplierAgent.sendMessage(conversationId, body),
    onSuccess: invalidate,
  });
}

/** A confirmed action changes real data (blocks, prices, requests), so refetch everything. */
export function useConfirmAgentAction(api: ApiClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.supplierAgent.confirmAction,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useCancelAgentAction(api: ApiClient) {
  const invalidate = useInvalidateAgent();
  return useMutation({ mutationFn: api.supplierAgent.cancelAction, onSuccess: invalidate });
}
