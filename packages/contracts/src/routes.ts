import type { z } from 'zod';
import type { RegistrableRole } from './accounts.js';
import { cancelBookingSchema, listBookingsQuerySchema } from './booking.js';
import {
  createConversationSchema,
  listConversationsQuerySchema,
  sendChatMessageSchema,
} from './equipment-assistant.js';
import { listNotificationsQuerySchema } from './notification.js';
import {
  createQuoteSchema,
  listQuotesQuerySchema,
  rejectQuoteSchema,
  updateQuoteSchema,
} from './quote.js';
import { putRateCardSchema } from './rate-card.js';
import {
  createRentalRequestSchema,
  listIncomingRentalRequestsQuerySchema,
  listMyRentalRequestsQuerySchema,
  rejectRentalRequestSchema,
} from './rental-request.js';
import {
  createRequirementSchema,
  listRequirementsQuerySchema,
  requirementMatchesQuerySchema,
  sendRequirementSchema,
  updateRequirementSchema,
} from './requirement.js';

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

export interface RouteContract {
  method: RouteMethod;
  /** Nest-style path, `:id` for parameters. */
  path: string;
  /** Roles allowed in; an empty list means any signed-in account. */
  roles: readonly RegistrableRole[];
  body?: z.ZodType;
  query?: z.ZodType;
}

const B = ['BUILDER'] as const;
const S = ['SUPPLIER'] as const;
const BS = ['BUILDER', 'SUPPLIER'] as const;
const ANY = [] as const;

/**
 * Every route added for the remaining features. The api registers exactly these, and
 * later issues fill in the handlers without changing path, role or schema.
 */
export const featureRoutes = {
  rentalRequests: [
    { method: 'POST', path: '/rental-requests', roles: B, body: createRentalRequestSchema },
    {
      method: 'GET',
      path: '/rental-requests/mine',
      roles: B,
      query: listMyRentalRequestsQuerySchema,
    },
    { method: 'POST', path: '/rental-requests/:id/cancel', roles: B },
    {
      method: 'GET',
      path: '/rental-requests/incoming',
      roles: S,
      query: listIncomingRentalRequestsQuerySchema,
    },
    { method: 'POST', path: '/rental-requests/:id/viewed', roles: S },
    {
      method: 'POST',
      path: '/rental-requests/:id/reject',
      roles: S,
      body: rejectRentalRequestSchema,
    },
    { method: 'GET', path: '/rental-requests/:id', roles: BS },
  ],
  rateCards: [
    { method: 'GET', path: '/supplier/listings/:id/rate-card', roles: S },
    { method: 'PUT', path: '/supplier/listings/:id/rate-card', roles: S, body: putRateCardSchema },
  ],
  quotes: [
    { method: 'POST', path: '/quotes', roles: S, body: createQuoteSchema },
    { method: 'GET', path: '/quotes/supplier', roles: S, query: listQuotesQuerySchema },
    { method: 'PATCH', path: '/quotes/:id', roles: S, body: updateQuoteSchema },
    { method: 'POST', path: '/quotes/:id/send', roles: S },
    { method: 'GET', path: '/quotes/builder', roles: B, query: listQuotesQuerySchema },
    { method: 'POST', path: '/quotes/:id/accept', roles: B },
    { method: 'POST', path: '/quotes/:id/reject', roles: B, body: rejectQuoteSchema },
    { method: 'GET', path: '/quotes/:id', roles: BS },
  ],
  bookings: [
    { method: 'GET', path: '/bookings/supplier', roles: S, query: listBookingsQuerySchema },
    { method: 'GET', path: '/bookings/builder', roles: B, query: listBookingsQuerySchema },
    { method: 'GET', path: '/bookings/:id', roles: BS },
    { method: 'POST', path: '/bookings/:id/dispatch', roles: S },
    { method: 'POST', path: '/bookings/:id/start-rent', roles: S },
    { method: 'POST', path: '/bookings/:id/complete', roles: S },
    { method: 'POST', path: '/bookings/:id/cancel', roles: BS, body: cancelBookingSchema },
  ],
  requirements: [
    { method: 'POST', path: '/requirements', roles: B, body: createRequirementSchema },
    { method: 'GET', path: '/requirements', roles: B, query: listRequirementsQuerySchema },
    { method: 'GET', path: '/requirements/:id', roles: B },
    { method: 'PATCH', path: '/requirements/:id', roles: B, body: updateRequirementSchema },
    {
      method: 'GET',
      path: '/requirements/:id/matches',
      roles: B,
      query: requirementMatchesQuerySchema,
    },
    { method: 'POST', path: '/requirements/:id/send', roles: B, body: sendRequirementSchema },
    { method: 'POST', path: '/requirements/:id/cancel', roles: B },
  ],
  notifications: [
    { method: 'GET', path: '/notifications', roles: ANY, query: listNotificationsQuerySchema },
    { method: 'POST', path: '/notifications/:id/read', roles: ANY },
    { method: 'POST', path: '/notifications/read-all', roles: ANY },
  ],
  equipmentAssistant: [
    {
      method: 'POST',
      path: '/equipment-assistant/conversations',
      roles: B,
      body: createConversationSchema,
    },
    {
      method: 'GET',
      path: '/equipment-assistant/conversations',
      roles: B,
      query: listConversationsQuerySchema,
    },
    { method: 'GET', path: '/equipment-assistant/conversations/:id', roles: B },
    {
      method: 'POST',
      path: '/equipment-assistant/conversations/:id/messages',
      roles: B,
      body: sendChatMessageSchema,
    },
  ],
  supplierAgent: [
    {
      method: 'POST',
      path: '/supplier-agent/conversations',
      roles: S,
      body: createConversationSchema,
    },
    {
      method: 'GET',
      path: '/supplier-agent/conversations',
      roles: S,
      query: listConversationsQuerySchema,
    },
    { method: 'GET', path: '/supplier-agent/conversations/:id', roles: S },
    {
      method: 'POST',
      path: '/supplier-agent/conversations/:id/messages',
      roles: S,
      body: sendChatMessageSchema,
    },
    { method: 'POST', path: '/supplier-agent/actions/:id/confirm', roles: S },
    { method: 'POST', path: '/supplier-agent/actions/:id/cancel', roles: S },
  ],
} as const satisfies Record<string, readonly RouteContract[]>;

export type FeatureRouteGroup = keyof typeof featureRoutes;

export const allFeatureRoutes: readonly RouteContract[] = Object.values(featureRoutes).flat();
