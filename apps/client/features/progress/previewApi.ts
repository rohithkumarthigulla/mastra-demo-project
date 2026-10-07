import type {
  CreateRentalRequest,
  CreateRequirementRequest,
  EquipmentListingDto,
  ListBookingsQuery,
  ListMyRentalRequestsQuery,
  ListRequirementsQuery,
  SendRequirementRequest,
} from '@ee/contracts';
import { requirementSchema } from '@ee/contracts';
import { ApiError, type ApiClient, type NotificationsQuery } from '../../api';
import { orMock } from './mockFallback';
import { mockPage } from './mocks';
import {
  preview,
  previewAcceptQuote,
  previewCancelBooking,
  previewCancelRequest,
  previewCancelRequirement,
  previewCreateRequest,
  previewCreateRequirement,
  previewMarkAllRead,
  previewMarkRead,
  previewRejectQuote,
  previewSendRequirement,
  snapshot,
} from './previewStore';

type Page = { limit?: number; offset?: number };

function byStatus<T extends { status: string }>(items: T[], status?: string): T[] {
  return status ? items.filter((i) => i.status === status) : items;
}

/** A fresh copy so callers (and the query cache) never share objects with the store. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The builder's rental calls, each falling back to the in-memory preview store while the
 * api answers 501. Reads return sample data; writes apply the documented side effects to
 * that store so the next read reflects them.
 */
export function builderApi(api: ApiClient) {
  return {
    myRequests: (query: Partial<ListMyRentalRequestsQuery> & Page = {}) =>
      orMock(api.rentalRequests.mine(query), () =>
        mockPage(
          snapshot((s) => byStatus(s.requests, query.status)),
          query,
        ),
      ),
    request: (requestId: string) =>
      orMock(api.rentalRequests.get(requestId), () =>
        snapshot((s) => s.requests.find((r) => r.id === requestId) ?? notFound('Request')),
      ),
    createRequest: (body: CreateRentalRequest, listing: EquipmentListingDto) =>
      orMock(api.rentalRequests.create(body), () =>
        copy(
          previewCreateRequest(
            preview(),
            body,
            {
              id: listing.id,
              title: listing.title,
              coverPhotoUrl: listing.coverPhotoUrl,
              city: listing.city.name,
              pricePerDay: listing.pricePerDay,
            },
            listing.supplier.displayName,
          ),
        ),
      ),
    cancelRequest: (requestId: string) =>
      orMock(api.rentalRequests.cancel(requestId), () =>
        copy(previewCancelRequest(preview(), requestId)),
      ),

    quote: (quoteId: string) =>
      orMock(api.quotes.get(quoteId), () =>
        snapshot((s) => s.quotes.find((q) => q.id === quoteId) ?? notFound('Quote')),
      ),
    acceptQuote: (quoteId: string) =>
      orMock(api.quotes.accept(quoteId), () => copy(previewAcceptQuote(preview(), quoteId))),
    rejectQuote: (quoteId: string, reason?: string) =>
      orMock(api.quotes.reject(quoteId, reason ? { reason } : {}), () =>
        copy(previewRejectQuote(preview(), quoteId)),
      ),

    myBookings: (query: Partial<ListBookingsQuery> & Page = {}) =>
      orMock(api.bookings.listForBuilder(query), () =>
        mockPage(
          snapshot((s) => byStatus(s.bookings, query.status)),
          query,
        ),
      ),
    booking: (bookingId: string) =>
      orMock(api.bookings.get(bookingId), () =>
        snapshot((s) => s.bookings.find((b) => b.id === bookingId) ?? notFound('Booking')),
      ),
    cancelBooking: (bookingId: string, reason: string) =>
      orMock(api.bookings.cancel(bookingId, { reason }), () =>
        copy(previewCancelBooking(preview(), bookingId, reason)),
      ),

    requirements: (query: Partial<ListRequirementsQuery> & Page = {}) =>
      orMock(api.requirements.list(query), () =>
        mockPage(
          snapshot((s) =>
            byStatus(s.requirements, query.status).map((r) => requirementSchema.parse(r)),
          ),
          query,
        ),
      ),
    requirement: (requirementId: string) =>
      orMock(api.requirements.get(requirementId), () =>
        snapshot(
          (s) => s.requirements.find((r) => r.id === requirementId) ?? notFound('Requirement'),
        ),
      ),
    requirementMatches: (requirementId: string, query: Page = {}) =>
      orMock(api.requirements.matches(requirementId, query), () =>
        mockPage(
          snapshot((s) => s.matches),
          query,
        ),
      ),
    createRequirement: (body: CreateRequirementRequest, cityName: string) =>
      orMock(api.requirements.create(body), () =>
        copy(previewCreateRequirement(preview(), body, cityName)),
      ),
    sendRequirement: (requirementId: string, body: SendRequirementRequest) =>
      orMock(api.requirements.send(requirementId, body), () =>
        copy(previewSendRequirement(preview(), requirementId, body.listingIds, body.message)),
      ),
    cancelRequirement: (requirementId: string) =>
      orMock(api.requirements.cancel(requirementId), () =>
        copy(previewCancelRequirement(preview(), requirementId)),
      ),

    notifications: (query: NotificationsQuery = {}) =>
      orMock(api.notifications.list(query), () => {
        const all = snapshot((s) => s.notifications);
        const items = query.unreadOnly ? all.filter((n) => !n.readAt) : all;
        return { ...mockPage(items, query), unreadCount: all.filter((n) => !n.readAt).length };
      }),
    markNotificationRead: (notificationId: string) =>
      orMock(api.notifications.markRead(notificationId), () =>
        copy(previewMarkRead(preview(), notificationId)),
      ),
    markAllNotificationsRead: () =>
      orMock(api.notifications.markAllRead(), () => previewMarkAllRead(preview())),
  };
}

export type BuilderApi = ReturnType<typeof builderApi>;

function notFound(what: string): never {
  throw new ApiError(404, 'not_found', `${what} not found`);
}
