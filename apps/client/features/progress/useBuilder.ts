import type {
  CreateRentalRequest,
  CreateRequirementRequest,
  ListBookingsQuery,
  ListMyRentalRequestsQuery,
  ListRequirementsQuery,
  SendRequirementRequest,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bookingKeys,
  notificationKeys,
  quoteKeys,
  rentalRequestKeys,
  requirementKeys,
} from '../../api';
import { useSession } from '../auth';

/** Builder-side queries and mutations, on the same cache keys as the typed hooks in `api/`. */
function useApi() {
  return useSession().api;
}

type Page = { limit?: number; offset?: number };

// Every write here can move a request, quote, booking or requirement, and may notify.
const RENTAL_ROOTS = [
  rentalRequestKeys.all,
  quoteKeys.all,
  bookingKeys.all,
  requirementKeys.all,
  notificationKeys.all,
];

function useInvalidateRental() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(RENTAL_ROOTS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useMyRequests(query: Partial<ListMyRentalRequestsQuery> & Page) {
  const api = useApi();
  return useQuery({
    queryKey: rentalRequestKeys.mine(query),
    queryFn: () => api.rentalRequests.mine(query),
  });
}

export function useRequest(requestId: string) {
  const api = useApi();
  return useQuery({
    queryKey: rentalRequestKeys.detail(requestId),
    queryFn: () => api.rentalRequests.get(requestId),
  });
}

export function useCreateRequest() {
  const api = useApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: (body: CreateRentalRequest) => api.rentalRequests.create(body),
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const api = useApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: (requestId: string) => api.rentalRequests.cancel(requestId),
    onSuccess: invalidate,
  });
}

export function useQuoteDetail(quoteId: string) {
  const api = useApi();
  return useQuery({ queryKey: quoteKeys.detail(quoteId), queryFn: () => api.quotes.get(quoteId) });
}

export function useAcceptQuoteAction() {
  const api = useApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: (quoteId: string) => api.quotes.accept(quoteId),
    onSuccess: invalidate,
  });
}

export function useRejectQuoteAction() {
  const api = useApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: ({ quoteId, reason }: { quoteId: string; reason?: string }) =>
      api.quotes.reject(quoteId, reason ? { reason } : {}),
    onSuccess: invalidate,
  });
}

export function useMyBookings(query: Partial<ListBookingsQuery> & Page) {
  const api = useApi();
  return useQuery({
    queryKey: bookingKeys.builder(query),
    queryFn: () => api.bookings.listForBuilder(query),
  });
}

export function useBookingDetail(bookingId: string) {
  const api = useApi();
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => api.bookings.get(bookingId),
  });
}

export function useCancelBookingAction() {
  const api = useApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason: string }) =>
      api.bookings.cancel(bookingId, { reason }),
    onSuccess: invalidate,
  });
}

export function useMyRequirements(query: Partial<ListRequirementsQuery> & Page) {
  const api = useApi();
  return useQuery({
    queryKey: requirementKeys.list(query),
    queryFn: () => api.requirements.list(query),
  });
}

export function useRequirementDetail(requirementId: string) {
  const api = useApi();
  return useQuery({
    queryKey: requirementKeys.detail(requirementId),
    queryFn: () => api.requirements.get(requirementId),
  });
}

export function useMatches(requirementId: string, query: Page, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: requirementKeys.matches(requirementId, query),
    queryFn: () => api.requirements.matches(requirementId, query),
    enabled,
  });
}

export function useCreateRequirementAction() {
  const api = useApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: (body: CreateRequirementRequest) => api.requirements.create(body),
    onSuccess: invalidate,
  });
}

export function useSendRequirementAction() {
  const api = useApi();
  const invalidate = useInvalidateRental();
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

export function useCancelRequirementAction() {
  const api = useApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: (requirementId: string) => api.requirements.cancel(requirementId),
    onSuccess: invalidate,
  });
}
