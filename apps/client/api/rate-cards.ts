import { rateCardSchema, type PutRateCardRequest, type RateCardDto } from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient, ApiRequest } from './client';

const id = encodeURIComponent;

export function createRateCardsApi(request: ApiRequest) {
  return {
    get: (listingId: string): Promise<RateCardDto> =>
      request(`/supplier/listings/${id(listingId)}/rate-card`, { schema: rateCardSchema }),
    put: (listingId: string, body: PutRateCardRequest): Promise<RateCardDto> =>
      request(`/supplier/listings/${id(listingId)}/rate-card`, {
        method: 'PUT',
        body,
        schema: rateCardSchema,
      }),
  };
}

export const rateCardKeys = {
  all: ['rate-cards'] as const,
  detail: (listingId: string) => ['rate-cards', listingId] as const,
};

export function useRateCard(api: ApiClient, listingId: string) {
  return useQuery({
    queryKey: rateCardKeys.detail(listingId),
    queryFn: () => api.rateCards.get(listingId),
  });
}

export function usePutRateCard(api: ApiClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, body }: { listingId: string; body: PutRateCardRequest }) =>
      api.rateCards.put(listingId, body),
    onSuccess: (card) => queryClient.setQueryData(rateCardKeys.detail(card.listingId), card),
  });
}
