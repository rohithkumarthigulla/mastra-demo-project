import type {
  CreateRentalRequest,
  CreateRequirementRequest,
  EquipmentListingDto,
  ListBookingsQuery,
  ListMyRentalRequestsQuery,
  ListRequirementsQuery,
  SendRequirementRequest,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  bookingKeys,
  notificationKeys,
  type NotificationsQuery,
  quoteKeys,
  rentalRequestKeys,
  requirementKeys,
} from '../../api';
import { useSession } from '../auth';
import { builderApi } from './previewApi';

/**
 * Builder-side queries and mutations. Same cache keys as the typed hooks in `api/`, so the
 * caches stay shared; the difference is the 501 fallback to preview data.
 */
export function useBuilderApi() {
  const { api } = useSession();
  return useMemo(() => builderApi(api), [api]);
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
  const b = useBuilderApi();
  return useQuery({ queryKey: rentalRequestKeys.mine(query), queryFn: () => b.myRequests(query) });
}

export function useRequest(requestId: string) {
  const b = useBuilderApi();
  return useQuery({
    queryKey: rentalRequestKeys.detail(requestId),
    queryFn: () => b.request(requestId),
  });
}

export function useCreateRequest() {
  const b = useBuilderApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: ({ body, listing }: { body: CreateRentalRequest; listing: EquipmentListingDto }) =>
      b.createRequest(body, listing),
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const b = useBuilderApi();
  const invalidate = useInvalidateRental();
  return useMutation({ mutationFn: b.cancelRequest, onSuccess: invalidate });
}

export function useQuoteDetail(quoteId: string) {
  const b = useBuilderApi();
  return useQuery({ queryKey: quoteKeys.detail(quoteId), queryFn: () => b.quote(quoteId) });
}

export function useAcceptQuoteAction() {
  const b = useBuilderApi();
  const invalidate = useInvalidateRental();
  return useMutation({ mutationFn: b.acceptQuote, onSuccess: invalidate });
}

export function useRejectQuoteAction() {
  const b = useBuilderApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: ({ quoteId, reason }: { quoteId: string; reason?: string }) =>
      b.rejectQuote(quoteId, reason),
    onSuccess: invalidate,
  });
}

export function useMyBookings(query: Partial<ListBookingsQuery> & Page) {
  const b = useBuilderApi();
  return useQuery({ queryKey: bookingKeys.builder(query), queryFn: () => b.myBookings(query) });
}

export function useBookingDetail(bookingId: string) {
  const b = useBuilderApi();
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => b.booking(bookingId),
  });
}

export function useCancelBookingAction() {
  const b = useBuilderApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason: string }) =>
      b.cancelBooking(bookingId, reason),
    onSuccess: invalidate,
  });
}

export function useMyRequirements(query: Partial<ListRequirementsQuery> & Page) {
  const b = useBuilderApi();
  return useQuery({
    queryKey: requirementKeys.list(query),
    queryFn: () => b.requirements(query),
  });
}

export function useRequirementDetail(requirementId: string) {
  const b = useBuilderApi();
  return useQuery({
    queryKey: requirementKeys.detail(requirementId),
    queryFn: () => b.requirement(requirementId),
  });
}

export function useMatches(requirementId: string, query: Page, enabled = true) {
  const b = useBuilderApi();
  return useQuery({
    queryKey: requirementKeys.matches(requirementId, query),
    queryFn: () => b.requirementMatches(requirementId, query),
    enabled,
  });
}

export function useCreateRequirementAction() {
  const b = useBuilderApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: ({ body, cityName }: { body: CreateRequirementRequest; cityName: string }) =>
      b.createRequirement(body, cityName),
    onSuccess: invalidate,
  });
}

export function useSendRequirementAction() {
  const b = useBuilderApi();
  const invalidate = useInvalidateRental();
  return useMutation({
    mutationFn: ({
      requirementId,
      body,
    }: {
      requirementId: string;
      body: SendRequirementRequest;
    }) => b.sendRequirement(requirementId, body),
    onSuccess: invalidate,
  });
}

export function useCancelRequirementAction() {
  const b = useBuilderApi();
  const invalidate = useInvalidateRental();
  return useMutation({ mutationFn: b.cancelRequirement, onSuccess: invalidate });
}

export function useNotificationFeed(query: NotificationsQuery) {
  const b = useBuilderApi();
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: () => b.notifications(query),
  });
}

export function useMarkRead() {
  const b = useBuilderApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: b.markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const b = useBuilderApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: b.markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
