import {
  rentalRequestPageSchema,
  rentalRequestSchema,
  type CreateRentalRequest,
  type ListIncomingRentalRequestsQuery,
  type ListMyRentalRequestsQuery,
  type RejectRentalRequest,
  type RentalRequestDto,
  type RentalRequestPageDto,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString, type ApiClient, type ApiRequest } from './client';

const id = encodeURIComponent;

export function createRentalRequestsApi(request: ApiRequest) {
  return {
    create: (body: CreateRentalRequest): Promise<RentalRequestDto> =>
      request('/rental-requests', { method: 'POST', body, schema: rentalRequestSchema }),
    mine: (query: Partial<ListMyRentalRequestsQuery> = {}): Promise<RentalRequestPageDto> =>
      request(`/rental-requests/mine${toQueryString(query)}`, { schema: rentalRequestPageSchema }),
    cancel: (requestId: string): Promise<RentalRequestDto> =>
      request(`/rental-requests/${id(requestId)}/cancel`, {
        method: 'POST',
        schema: rentalRequestSchema,
      }),
    incoming: (
      query: Partial<ListIncomingRentalRequestsQuery> = {},
    ): Promise<RentalRequestPageDto> =>
      request(`/rental-requests/incoming${toQueryString(query)}`, {
        schema: rentalRequestPageSchema,
      }),
    markViewed: (requestId: string): Promise<RentalRequestDto> =>
      request(`/rental-requests/${id(requestId)}/viewed`, {
        method: 'POST',
        schema: rentalRequestSchema,
      }),
    reject: (requestId: string, body: RejectRentalRequest = {}): Promise<RentalRequestDto> =>
      request(`/rental-requests/${id(requestId)}/reject`, {
        method: 'POST',
        body,
        schema: rentalRequestSchema,
      }),
    get: (requestId: string): Promise<RentalRequestDto> =>
      request(`/rental-requests/${id(requestId)}`, { schema: rentalRequestSchema }),
  };
}

export const rentalRequestKeys = {
  all: ['rental-requests'] as const,
  mine: (query: Partial<ListMyRentalRequestsQuery> = {}) =>
    ['rental-requests', 'mine', query] as const,
  incoming: (query: Partial<ListIncomingRentalRequestsQuery> = {}) =>
    ['rental-requests', 'incoming', query] as const,
  detail: (requestId: string) => ['rental-requests', 'detail', requestId] as const,
};

function useInvalidateRentalRequests() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: rentalRequestKeys.all });
}

export function useMyRentalRequests(
  api: ApiClient,
  query: Partial<ListMyRentalRequestsQuery> = {},
) {
  return useQuery({
    queryKey: rentalRequestKeys.mine(query),
    queryFn: () => api.rentalRequests.mine(query),
  });
}

export function useIncomingRentalRequests(
  api: ApiClient,
  query: Partial<ListIncomingRentalRequestsQuery> = {},
) {
  return useQuery({
    queryKey: rentalRequestKeys.incoming(query),
    queryFn: () => api.rentalRequests.incoming(query),
  });
}

export function useRentalRequest(api: ApiClient, requestId: string) {
  return useQuery({
    queryKey: rentalRequestKeys.detail(requestId),
    queryFn: () => api.rentalRequests.get(requestId),
  });
}

export function useCreateRentalRequest(api: ApiClient) {
  const invalidate = useInvalidateRentalRequests();
  return useMutation({ mutationFn: api.rentalRequests.create, onSuccess: invalidate });
}

export function useCancelRentalRequest(api: ApiClient) {
  const invalidate = useInvalidateRentalRequests();
  return useMutation({ mutationFn: api.rentalRequests.cancel, onSuccess: invalidate });
}

export function useMarkRentalRequestViewed(api: ApiClient) {
  const invalidate = useInvalidateRentalRequests();
  return useMutation({ mutationFn: api.rentalRequests.markViewed, onSuccess: invalidate });
}

export function useRejectRentalRequest(api: ApiClient) {
  const invalidate = useInvalidateRentalRequests();
  return useMutation({
    mutationFn: ({ requestId, body }: { requestId: string; body?: RejectRentalRequest }) =>
      api.rentalRequests.reject(requestId, body),
    onSuccess: invalidate,
  });
}
