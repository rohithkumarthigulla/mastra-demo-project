import {
  REQUIREMENT_MAX_SUPPLIERS,
  type CalendarDate,
  type QuoteStatus,
  type RentalRequestStatus,
  type RequirementStatus,
  type SendSkipReason,
} from '@ee/contracts';
import { SupplierLimitExceededError } from './errors';

export interface Requirement {
  id: string;
  builderAccountId: string;
  status: RequirementStatus;
  title: string;
  categoryCode: string;
  equipmentModelId: string | null;
  constructionTaskCode: string | null;
  city: { geoId: string; name: string };
  startDate: CalendarDate;
  endDate: CalendarDate;
  quantity: number;
  budgetPerDay: number | null;
  notes: string | null;
  sentAt: Date | null;
  awardedQuoteId: string | null;
  invitationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invitation {
  rentalRequestId: string;
  listingId: string;
  listingTitle: string;
  supplierName: string;
  status: RentalRequestStatus;
  viewedAt: Date | null;
  quote: { id: string; status: QuoteStatus; total: number } | null;
}

export interface RequirementMatch {
  listing: {
    id: string;
    title: string;
    coverPhotoUrl: string | null;
    city: string;
    pricePerDay: number;
  };
  supplierName: string;
  availableUnits: number;
  alreadyInvited: boolean;
}

/** A listing the builder asked to invite, with what is needed to decide whether to send. */
export interface SendTarget {
  listingId: string;
  listingTitle: string;
  listingStatus: string;
  supplierAccountId: string;
  supplierName: string;
  availableUnits: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight in Asia/Kolkata (fixed +05:30, no DST) at the start of `date`. */
function rentalMidnight(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00+05:30`);
}

/** Half-open `[start, end)` covering every rental day, the same as bookings and blocks. */
export function rentalRange(startDate: CalendarDate, endDate: CalendarDate): TimeRange {
  return {
    start: rentalMidnight(startDate),
    end: new Date(rentalMidnight(endDate).getTime() + DAY_MS),
  };
}

export interface SendPlan {
  send: SendTarget[];
  skipped: { listingId: string; reason: SendSkipReason }[];
}

/**
 * Decides which requested listings get an invitation. Unknown listings count as not active.
 * Throws when the new invitations would take the requirement past the supplier limit.
 */
export function planSend(
  listingIds: string[],
  targets: SendTarget[],
  invitedListingIds: ReadonlySet<string>,
): SendPlan {
  const byId = new Map(targets.map((t) => [t.listingId, t]));
  const plan: SendPlan = { send: [], skipped: [] };
  for (const listingId of listingIds) {
    const target = byId.get(listingId);
    if (invitedListingIds.has(listingId)) {
      plan.skipped.push({ listingId, reason: 'ALREADY_INVITED' });
    } else if (!target || target.listingStatus !== 'ACTIVE') {
      plan.skipped.push({ listingId, reason: 'NOT_ACTIVE' });
    } else if (target.availableUnits < 1) {
      plan.skipped.push({ listingId, reason: 'UNAVAILABLE' });
    } else {
      plan.send.push(target);
    }
  }
  const remaining = REQUIREMENT_MAX_SUPPLIERS - invitedListingIds.size;
  if (plan.send.length > remaining) throw new SupplierLimitExceededError(remaining);
  return plan;
}
