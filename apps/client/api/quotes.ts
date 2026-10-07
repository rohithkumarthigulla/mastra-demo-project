import {
  quotePageSchema,
  quoteSchema,
  type CreateQuoteRequest,
  type ListQuotesQuery,
  type QuoteDto,
  type QuotePageDto,
  type RejectQuoteRequest,
  type UpdateQuoteRequest,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString, type ApiClient, type ApiRequest } from './client';

const id = encodeURIComponent;

export function createQuotesApi(request: ApiRequest) {
  return {
    create: (body: CreateQuoteRequest): Promise<QuoteDto> =>
      request('/quotes', { method: 'POST', body, schema: quoteSchema }),
    listForSupplier: (query: Partial<ListQuotesQuery> = {}): Promise<QuotePageDto> =>
      request(`/quotes/supplier${toQueryString(query)}`, { schema: quotePageSchema }),
    update: (quoteId: string, body: UpdateQuoteRequest): Promise<QuoteDto> =>
      request(`/quotes/${id(quoteId)}`, { method: 'PATCH', body, schema: quoteSchema }),
    send: (quoteId: string): Promise<QuoteDto> =>
      request(`/quotes/${id(quoteId)}/send`, { method: 'POST', schema: quoteSchema }),
    listForBuilder: (query: Partial<ListQuotesQuery> = {}): Promise<QuotePageDto> =>
      request(`/quotes/builder${toQueryString(query)}`, { schema: quotePageSchema }),
    accept: (quoteId: string): Promise<QuoteDto> =>
      request(`/quotes/${id(quoteId)}/accept`, { method: 'POST', schema: quoteSchema }),
    reject: (quoteId: string, body: RejectQuoteRequest = {}): Promise<QuoteDto> =>
      request(`/quotes/${id(quoteId)}/reject`, { method: 'POST', body, schema: quoteSchema }),
    get: (quoteId: string): Promise<QuoteDto> =>
      request(`/quotes/${id(quoteId)}`, { schema: quoteSchema }),
  };
}

export const quoteKeys = {
  all: ['quotes'] as const,
  supplier: (query: Partial<ListQuotesQuery> = {}) => ['quotes', 'supplier', query] as const,
  builder: (query: Partial<ListQuotesQuery> = {}) => ['quotes', 'builder', query] as const,
  detail: (quoteId: string) => ['quotes', 'detail', quoteId] as const,
};

/** Quotes are shown inside rental requests, so both caches go stale together. */
function useInvalidateQuotes() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    await queryClient.invalidateQueries({ queryKey: ['rental-requests'] });
  };
}

export function useSupplierQuotes(api: ApiClient, query: Partial<ListQuotesQuery> = {}) {
  return useQuery({
    queryKey: quoteKeys.supplier(query),
    queryFn: () => api.quotes.listForSupplier(query),
  });
}

export function useBuilderQuotes(api: ApiClient, query: Partial<ListQuotesQuery> = {}) {
  return useQuery({
    queryKey: quoteKeys.builder(query),
    queryFn: () => api.quotes.listForBuilder(query),
  });
}

export function useQuote(api: ApiClient, quoteId: string) {
  return useQuery({ queryKey: quoteKeys.detail(quoteId), queryFn: () => api.quotes.get(quoteId) });
}

export function useCreateQuote(api: ApiClient) {
  const invalidate = useInvalidateQuotes();
  return useMutation({ mutationFn: api.quotes.create, onSuccess: invalidate });
}

export function useUpdateQuote(api: ApiClient) {
  const invalidate = useInvalidateQuotes();
  return useMutation({
    mutationFn: ({ quoteId, body }: { quoteId: string; body: UpdateQuoteRequest }) =>
      api.quotes.update(quoteId, body),
    onSuccess: invalidate,
  });
}

export function useSendQuote(api: ApiClient) {
  const invalidate = useInvalidateQuotes();
  return useMutation({ mutationFn: api.quotes.send, onSuccess: invalidate });
}

export function useAcceptQuote(api: ApiClient) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateQuotes();
  return useMutation({
    mutationFn: api.quotes.accept,
    // Accepting also creates a booking and may award a requirement.
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['requirements'] });
    },
  });
}

export function useRejectQuote(api: ApiClient) {
  const invalidate = useInvalidateQuotes();
  return useMutation({
    mutationFn: ({ quoteId, body }: { quoteId: string; body?: RejectQuoteRequest }) =>
      api.quotes.reject(quoteId, body),
    onSuccess: invalidate,
  });
}
