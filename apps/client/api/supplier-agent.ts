import {
  agentConversationDetailSchema,
  agentProgressSchema,
  agentReplySchema,
  conversationPageSchema,
  conversationSchema,
  pendingActionSchema,
  speechStatusSchema,
  transcriptionSchema,
  type AgentConversationDetailDto,
  type AgentProgressDto,
  type AgentReplyDto,
  type ConversationDto,
  type ConversationPageDto,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type PendingActionDto,
  type SendAgentMessageRequest,
  type SpeechStatusDto,
  type SynthesizeQuery,
  type TranscribeQuery,
  type TranscriptionDto,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString, type ApiClient, type ApiRequest, type UploadFile } from './client';

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
    sendMessage: (conversationId: string, body: SendAgentMessageRequest): Promise<AgentReplyDto> =>
      request(`${BASE}/conversations/${id(conversationId)}/messages`, {
        method: 'POST',
        body,
        schema: agentReplySchema,
      }),
    /** What the agent is doing for an in-flight reply, for a plain progress line. */
    progress: (conversationId: string): Promise<AgentProgressDto> =>
      request(`${BASE}/conversations/${id(conversationId)}/progress`, {
        schema: agentProgressSchema,
      }),
    speechStatus: (): Promise<SpeechStatusDto> =>
      request(`${BASE}/speech`, { schema: speechStatusSchema }),
    transcribe: (recording: UploadFile, query: TranscribeQuery = {}): Promise<TranscriptionDto> => {
      const form = new FormData();
      form.append(
        'file',
        recording as Blob,
        recording instanceof Blob ? 'speech.webm' : recording.name,
      );
      return request(`${BASE}/speech/transcribe${toQueryString({ ...query })}`, {
        method: 'POST',
        body: form,
        schema: transcriptionSchema,
      });
    },
    /** Spoken audio (WAV) for one sentence of a reply. */
    synthesize: (query: SynthesizeQuery): Promise<Blob> =>
      request(`${BASE}/speech/audio${speechAudioQuery(query)}`, { blob: true }),
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

/** Query string for `GET /supplier-agent/speech/audio`; native players stream it by URL. */
export function speechAudioQuery(query: SynthesizeQuery): string {
  return toQueryString({ ...query });
}

export const supplierAgentKeys = {
  all: ['supplier-agent'] as const,
  conversations: (query: Partial<ListConversationsQuery> = {}) =>
    ['supplier-agent', 'conversations', query] as const,
  conversation: (conversationId: string) =>
    ['supplier-agent', 'conversation', conversationId] as const,
  speech: ['supplier-agent', 'speech'] as const,
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
      body: SendAgentMessageRequest;
    }) => api.supplierAgent.sendMessage(conversationId, body),
    onSuccess: invalidate,
  });
}

/** Whether the server has a speech key; without one the voice button stays hidden. */
export function useAgentSpeechStatus(api: ApiClient) {
  return useQuery({
    queryKey: supplierAgentKeys.speech,
    queryFn: api.supplierAgent.speechStatus,
    staleTime: Infinity,
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
