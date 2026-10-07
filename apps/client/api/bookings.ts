import {
  bookingPageSchema,
  bookingSchema,
  type BookingDto,
  type BookingPageDto,
  type CancelBookingRequest,
  type ListBookingsQuery,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQueryString, type ApiClient, type ApiRequest } from './client';

const id = encodeURIComponent;

export function createBookingsApi(request: ApiRequest) {
  const transition = (bookingId: string, action: string): Promise<BookingDto> =>
    request(`/bookings/${id(bookingId)}/${action}`, { method: 'POST', schema: bookingSchema });
  return {
    listForSupplier: (query: Partial<ListBookingsQuery> = {}): Promise<BookingPageDto> =>
      request(`/bookings/supplier${toQueryString(query)}`, { schema: bookingPageSchema }),
    listForBuilder: (query: Partial<ListBookingsQuery> = {}): Promise<BookingPageDto> =>
      request(`/bookings/builder${toQueryString(query)}`, { schema: bookingPageSchema }),
    get: (bookingId: string): Promise<BookingDto> =>
      request(`/bookings/${id(bookingId)}`, { schema: bookingSchema }),
    dispatch: (bookingId: string) => transition(bookingId, 'dispatch'),
    startRent: (bookingId: string) => transition(bookingId, 'start-rent'),
    complete: (bookingId: string) => transition(bookingId, 'complete'),
    cancel: (bookingId: string, body: CancelBookingRequest): Promise<BookingDto> =>
      request(`/bookings/${id(bookingId)}/cancel`, {
        method: 'POST',
        body,
        schema: bookingSchema,
      }),
  };
}

export const bookingKeys = {
  all: ['bookings'] as const,
  supplier: (query: Partial<ListBookingsQuery> = {}) => ['bookings', 'supplier', query] as const,
  builder: (query: Partial<ListBookingsQuery> = {}) => ['bookings', 'builder', query] as const,
  detail: (bookingId: string) => ['bookings', 'detail', bookingId] as const,
};

function useInvalidateBookings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: bookingKeys.all });
}

export function useSupplierBookings(api: ApiClient, query: Partial<ListBookingsQuery> = {}) {
  return useQuery({
    queryKey: bookingKeys.supplier(query),
    queryFn: () => api.bookings.listForSupplier(query),
  });
}

export function useBuilderBookings(api: ApiClient, query: Partial<ListBookingsQuery> = {}) {
  return useQuery({
    queryKey: bookingKeys.builder(query),
    queryFn: () => api.bookings.listForBuilder(query),
  });
}

export function useBooking(api: ApiClient, bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => api.bookings.get(bookingId),
  });
}

export function useDispatchBooking(api: ApiClient) {
  const invalidate = useInvalidateBookings();
  return useMutation({ mutationFn: api.bookings.dispatch, onSuccess: invalidate });
}

export function useStartRent(api: ApiClient) {
  const invalidate = useInvalidateBookings();
  return useMutation({ mutationFn: api.bookings.startRent, onSuccess: invalidate });
}

export function useCompleteBooking(api: ApiClient) {
  const invalidate = useInvalidateBookings();
  return useMutation({ mutationFn: api.bookings.complete, onSuccess: invalidate });
}

export function useCancelBooking(api: ApiClient) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: ({ bookingId, body }: { bookingId: string; body: CancelBookingRequest }) =>
      api.bookings.cancel(bookingId, body),
    onSuccess: invalidate,
  });
}
