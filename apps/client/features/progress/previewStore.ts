import {
  rentalDays,
  todayInRentalZone,
  type BookingDto,
  type CreateRentalRequest,
  type CreateRequirementRequest,
  type ListingSummaryDto,
  type NotificationDto,
  type QuoteDto,
  type RentalRequestDto,
  type RequirementDetailDto,
  type RequirementMatchDto,
  type SendRequirementResponse,
} from '@ee/contracts';
import {
  mockBookings,
  mockNotifications,
  mockQuotes,
  mockRentalRequests,
  mockRequirement,
  mockRequirementMatches,
} from './mocks';
import { ApiError } from '../../api/errors';

/**
 * In-memory stand-in for the rental api while it answers 501. Mutations update it so the
 * builder can walk the whole flow (request → quote → booking) in one session; nothing is
 * persisted. Each operation mirrors the side effects the api contract documents.
 */
export interface PreviewState {
  requests: RentalRequestDto[];
  quotes: QuoteDto[];
  bookings: BookingDto[];
  requirements: RequirementDetailDto[];
  matches: RequirementMatchDto[];
  notifications: NotificationDto[];
}

export function createPreviewState(today = todayInRentalZone()): PreviewState {
  return {
    requests: mockRentalRequests(today),
    quotes: mockQuotes(today),
    bookings: mockBookings(today),
    requirements: [mockRequirement(today)],
    matches: mockRequirementMatches(),
    notifications: mockNotifications(today).items,
  };
}

let state: PreviewState | null = null;

export function preview(): PreviewState {
  state ??= createPreviewState();
  return state;
}

/** Reads hand out copies so the query cache never holds objects that are later mutated. */
export function snapshot<T>(read: (s: PreviewState) => T): T {
  // DTOs are plain JSON; structuredClone isn't available on every React Native engine.
  return JSON.parse(JSON.stringify(read(preview()))) as T;
}

/** Test hook: start over from the fixtures. */
export function resetPreview(next?: PreviewState) {
  state = next ?? null;
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `00000000-0000-4000-9000-${String(counter).padStart(12, '0')}`;
}

/** Mirrors the api's 409 for an action the current status doesn't allow. */
const conflict = (message: string) => new ApiError(409, 'conflict', message);

const now = () => new Date().toISOString();

function find<T extends { id: string }>(items: T[], id: string, what: string): T {
  const item = items.find((i) => i.id === id);
  if (!item) throw new ApiError(404, 'not_found', `${what} not found`);
  return item;
}

function syncInvitation(s: PreviewState, request: RentalRequestDto) {
  for (const requirement of s.requirements) {
    const invitation = requirement.invitations.find((i) => i.rentalRequestId === request.id);
    if (invitation) {
      invitation.status = request.status;
      invitation.quote = request.latestQuote;
    }
  }
}

export function previewCreateRequest(
  s: PreviewState,
  body: CreateRentalRequest,
  listing: ListingSummaryDto,
  supplierName: string,
): RentalRequestDto {
  const at = now();
  const request: RentalRequestDto = {
    id: newId(),
    status: 'PENDING',
    requirementId: null,
    startDate: body.startDate,
    endDate: body.endDate,
    days: rentalDays(body.startDate, body.endDate),
    message: body.message ?? null,
    declineReason: null,
    viewedAt: null,
    listing,
    builderName: s.requests[0]?.builderName ?? 'You',
    supplierName,
    latestQuote: null,
    createdAt: at,
    updatedAt: at,
  };
  s.requests.unshift(request);
  return request;
}

export function previewCancelRequest(s: PreviewState, requestId: string): RentalRequestDto {
  const request = find(s.requests, requestId, 'request');
  if (request.status !== 'PENDING') throw conflict('Only pending requests can be cancelled');
  request.status = 'CANCELLED';
  request.updatedAt = now();
  syncInvitation(s, request);
  return request;
}

/** Accepting books the unit, closes sibling requests on the requirement and awards it. */
export function previewAcceptQuote(s: PreviewState, quoteId: string): QuoteDto {
  const quote = find(s.quotes, quoteId, 'quote');
  if (quote.status !== 'SENT') throw conflict('Only a sent quote can be accepted');
  const at = now();
  const request = find(s.requests, quote.rentalRequest.id, 'request');

  const booking: BookingDto = {
    id: newId(),
    status: 'CONFIRMED',
    quoteId: quote.id,
    rentalRequestId: request.id,
    equipmentUnitId: quote.equipmentUnitId ?? newId(),
    startAt: kolkataMidnight(request.startDate, 0),
    endAt: kolkataMidnight(request.endDate, 1),
    startDate: request.startDate,
    endDate: request.endDate,
    days: request.days,
    total: quote.total,
    listing: quote.listing,
    builderName: quote.builderName,
    supplierName: quote.supplierName,
    dispatchedAt: null,
    rentStartedAt: null,
    returnedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: at,
    updatedAt: at,
  };
  s.bookings.unshift(booking);

  Object.assign(quote, { status: 'ACCEPTED', decidedAt: at, updatedAt: at, bookingId: booking.id });
  quote.rentalRequest.status = 'ACCEPTED';
  Object.assign(request, {
    status: 'ACCEPTED',
    updatedAt: at,
    latestQuote: { id: quote.id, status: quote.status, total: quote.total },
  });
  syncInvitation(s, request);

  if (request.requirementId) {
    for (const sibling of s.requests) {
      if (sibling.requirementId !== request.requirementId || sibling.id === request.id) continue;
      if (sibling.status !== 'PENDING') continue;
      Object.assign(sibling, { status: 'WITHDRAWN', updatedAt: at });
      syncInvitation(s, sibling);
    }
    const requirement = s.requirements.find((r) => r.id === request.requirementId);
    if (requirement) {
      Object.assign(requirement, { status: 'AWARDED', awardedQuoteId: quote.id, updatedAt: at });
    }
  }
  return quote;
}

export function previewRejectQuote(s: PreviewState, quoteId: string): QuoteDto {
  const quote = find(s.quotes, quoteId, 'quote');
  if (quote.status !== 'SENT') throw conflict('Only a sent quote can be rejected');
  const at = now();
  Object.assign(quote, { status: 'REJECTED', decidedAt: at, updatedAt: at });
  const request = s.requests.find((r) => r.id === quote.rentalRequest.id);
  if (request) {
    request.latestQuote = { id: quote.id, status: quote.status, total: quote.total };
    request.updatedAt = at;
    syncInvitation(s, request);
  }
  return quote;
}

export function previewCancelBooking(
  s: PreviewState,
  bookingId: string,
  reason: string,
): BookingDto {
  const booking = find(s.bookings, bookingId, 'booking');
  if (booking.status !== 'CONFIRMED' && booking.status !== 'OUT_FOR_DELIVERY') {
    throw conflict('This booking can no longer be cancelled');
  }
  const at = now();
  Object.assign(booking, {
    status: 'CANCELLED',
    cancelledAt: at,
    cancelReason: reason,
    updatedAt: at,
  });
  return booking;
}

export function previewCreateRequirement(
  s: PreviewState,
  body: CreateRequirementRequest,
  cityName: string,
): RequirementDetailDto {
  const at = now();
  const requirement: RequirementDetailDto = {
    id: newId(),
    status: 'DRAFT',
    title: body.title,
    categoryCode: body.categoryCode,
    equipmentModelId: body.equipmentModelId ?? null,
    constructionTaskCode: body.constructionTaskCode ?? null,
    city: { geoId: body.cityGeoId, name: cityName },
    startDate: body.startDate,
    endDate: body.endDate,
    days: rentalDays(body.startDate, body.endDate),
    quantity: body.quantity,
    budgetPerDay: body.budgetPerDay ?? null,
    notes: body.notes ?? null,
    sentAt: null,
    awardedQuoteId: null,
    invitationCount: 0,
    createdAt: at,
    updatedAt: at,
    invitations: [],
  };
  s.requirements.unshift(requirement);
  return requirement;
}

/** Fans out one PENDING request per listing, skipping ones already invited. */
export function previewSendRequirement(
  s: PreviewState,
  requirementId: string,
  listingIds: string[],
  message?: string,
): SendRequirementResponse {
  const requirement = find(s.requirements, requirementId, 'requirement');
  if (requirement.status !== 'DRAFT' && requirement.status !== 'OPEN') {
    throw conflict('This requirement is closed');
  }
  const response: SendRequirementResponse = { sent: [], skipped: [] };
  for (const listingId of listingIds) {
    const match = s.matches.find((m) => m.listing.id === listingId);
    if (requirement.invitations.some((i) => i.listingId === listingId)) {
      response.skipped.push({ listingId, reason: 'ALREADY_INVITED' });
      continue;
    }
    if (!match || match.availableUnits < 1) {
      response.skipped.push({ listingId, reason: 'UNAVAILABLE' });
      continue;
    }
    const request = previewCreateRequest(
      s,
      { listingId, startDate: requirement.startDate, endDate: requirement.endDate, message },
      match.listing,
      match.supplierName,
    );
    request.requirementId = requirement.id;
    const invitation = {
      rentalRequestId: request.id,
      listingId,
      listingTitle: match.listing.title,
      supplierName: match.supplierName,
      status: request.status,
      viewedAt: null,
      quote: null,
    };
    requirement.invitations.push(invitation);
    response.sent.push(invitation);
    match.alreadyInvited = true;
  }
  const at = now();
  Object.assign(requirement, {
    status: 'OPEN',
    sentAt: requirement.sentAt ?? at,
    invitationCount: requirement.invitations.length,
    updatedAt: at,
  });
  return response;
}

/** Cancelling closes every still-pending invitation. */
export function previewCancelRequirement(
  s: PreviewState,
  requirementId: string,
): RequirementDetailDto {
  const requirement = find(s.requirements, requirementId, 'requirement');
  if (requirement.status !== 'DRAFT' && requirement.status !== 'OPEN') {
    throw conflict('This requirement is already closed');
  }
  const at = now();
  Object.assign(requirement, { status: 'CANCELLED', updatedAt: at });
  for (const request of s.requests) {
    if (request.requirementId === requirementId && request.status === 'PENDING') {
      Object.assign(request, { status: 'CANCELLED', updatedAt: at });
      syncInvitation(s, request);
    }
  }
  return requirement;
}

export function previewMarkRead(s: PreviewState, notificationId: string): NotificationDto {
  const notification = find(s.notifications, notificationId, 'notification');
  notification.readAt ??= now();
  return notification;
}

export function previewMarkAllRead(s: PreviewState): { updated: number } {
  const at = now();
  let updated = 0;
  for (const n of s.notifications) {
    if (n.readAt) continue;
    n.readAt = at;
    updated += 1;
  }
  return { updated };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function kolkataMidnight(date: string, plusDays: number): string {
  return new Date(
    Date.parse(`${date}T00:00:00Z`) + plusDays * DAY_MS - KOLKATA_OFFSET_MS,
  ).toISOString();
}
