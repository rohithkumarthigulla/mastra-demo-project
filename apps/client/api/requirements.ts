import {
  requirementDetailSchema,
  requirementMatchPageSchema,
  requirementPageSchema,
  sendRequirementResponseSchema,
  type CreateRequirementRequest,
  type ListRequirementsQuery,
  type RequirementDetailDto,
  type RequirementMatchesQuery,
  type RequirementMatchPageDto,
  type RequirementPageDto,
  type SendRequirementRequest,
  type SendRequirementResponse,
  type UpdateRequirementRequest,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString, type ApiClient, type ApiRequest } from './client';

const id = encodeURIComponent;

export function createRequirementsApi(request: ApiRequest) {
  return {
    create: (body: CreateRequirementRequest): Promise<RequirementDetailDto> =>
      request('/requirements', { method: 'POST', body, schema: requirementDetailSchema }),
    list: (query: Partial<ListRequirementsQuery> = {}): Promise<RequirementPageDto> =>
      request(`/requirements${toQueryString(query)}`, { schema: requirementPageSchema }),
    get: (requirementId: string): Promise<RequirementDetailDto> =>
      request(`/requirements/${id(requirementId)}`, { schema: requirementDetailSchema }),
    update: (
      requirementId: string,
      body: UpdateRequirementRequest,
    ): Promise<RequirementDetailDto> =>
      request(`/requirements/${id(requirementId)}`, {
        method: 'PATCH',
        body,
        schema: requirementDetailSchema,
      }),
    matches: (
      requirementId: string,
      query: Partial<RequirementMatchesQuery> = {},
    ): Promise<RequirementMatchPageDto> =>
      request(`/requirements/${id(requirementId)}/matches${toQueryString(query)}`, {
        schema: requirementMatchPageSchema,
      }),
    send: (requirementId: string, body: SendRequirementRequest): Promise<SendRequirementResponse> =>
      request(`/requirements/${id(requirementId)}/send`, {
        method: 'POST',
        body,
        schema: sendRequirementResponseSchema,
      }),
    cancel: (requirementId: string): Promise<RequirementDetailDto> =>
      request(`/requirements/${id(requirementId)}/cancel`, {
        method: 'POST',
        schema: requirementDetailSchema,
      }),
  };
}

export const requirementKeys = {
  all: ['requirements'] as const,
  list: (query: Partial<ListRequirementsQuery> = {}) => ['requirements', 'list', query] as const,
  detail: (requirementId: string) => ['requirements', 'detail', requirementId] as const,
  matches: (requirementId: string, query: Partial<RequirementMatchesQuery> = {}) =>
    ['requirements', 'matches', requirementId, query] as const,
};

/** Sending and cancelling create or withdraw rental requests, so both caches go stale. */
function useInvalidateRequirements() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: requirementKeys.all });
    await queryClient.invalidateQueries({ queryKey: ['rental-requests'] });
  };
}

export function useRequirements(api: ApiClient, query: Partial<ListRequirementsQuery> = {}) {
  return useQuery({
    queryKey: requirementKeys.list(query),
    queryFn: () => api.requirements.list(query),
  });
}

export function useRequirement(api: ApiClient, requirementId: string) {
  return useQuery({
    queryKey: requirementKeys.detail(requirementId),
    queryFn: () => api.requirements.get(requirementId),
  });
}

export function useRequirementMatches(
  api: ApiClient,
  requirementId: string,
  query: Partial<RequirementMatchesQuery> = {},
) {
  return useQuery({
    queryKey: requirementKeys.matches(requirementId, query),
    queryFn: () => api.requirements.matches(requirementId, query),
  });
}

export function useCreateRequirement(api: ApiClient) {
  const invalidate = useInvalidateRequirements();
  return useMutation({ mutationFn: api.requirements.create, onSuccess: invalidate });
}

export function useUpdateRequirement(api: ApiClient) {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: ({
      requirementId,
      body,
    }: {
      requirementId: string;
      body: UpdateRequirementRequest;
    }) => api.requirements.update(requirementId, body),
    onSuccess: invalidate,
  });
}

export function useSendRequirement(api: ApiClient) {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: ({
      requirementId,
      body,
    }: {
      requirementId: string;
      body: SendRequirementRequest;
    }) => api.requirements.send(requirementId, body),
    onSuccess: invalidate,
  });
}

export function useCancelRequirement(api: ApiClient) {
  const invalidate = useInvalidateRequirements();
  return useMutation({ mutationFn: api.requirements.cancel, onSuccess: invalidate });
}
