import type {
  BookingDto,
  BookingStatus,
  QuoteStatus,
  RentalRequestDto,
  RentalRequestStatus,
  RequirementStatus,
} from '@ee/contracts';

export const STAGES = [
  { key: 'requested', label: 'Requested' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'booked', label: 'Booked' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'on_rent', label: 'On rent' },
  { key: 'returned', label: 'Returned' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];

/** Where a request or booking sits on the rental flow; `closed` ends it early. */
export interface StageState {
  current: StageKey;
  closed: string | null;
}

export function stageIndex(key: StageKey): number {
  return STAGES.findIndex((stage) => stage.key === key);
}

// Draft quotes are supplier-internal, so they don't move the builder's request forward.
const BUILDER_VISIBLE_QUOTES: readonly QuoteStatus[] = ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

export function requestStage(
  request: Pick<RentalRequestDto, 'status' | 'latestQuote'>,
): StageState {
  const quoted =
    request.latestQuote !== null && BUILDER_VISIBLE_QUOTES.includes(request.latestQuote.status);
  const reached: StageKey = quoted ? 'quoted' : 'requested';
  switch (request.status) {
    case 'PENDING':
      return { current: reached, closed: null };
    case 'ACCEPTED':
      return { current: 'booked', closed: null };
    case 'REJECTED':
      return { current: reached, closed: 'Declined' };
    case 'CANCELLED':
      return { current: reached, closed: 'Cancelled' };
    case 'WITHDRAWN':
      return { current: reached, closed: 'Withdrawn' };
  }
}

export function bookingStage(booking: Pick<BookingDto, 'status' | 'dispatchedAt'>): StageState {
  switch (booking.status) {
    case 'CONFIRMED':
      return { current: 'booked', closed: null };
    case 'OUT_FOR_DELIVERY':
      return { current: 'out_for_delivery', closed: null };
    case 'ON_RENT':
      return { current: 'on_rent', closed: null };
    case 'RETURNED':
      return { current: 'returned', closed: null };
    case 'CANCELLED':
      return {
        current: booking.dispatchedAt ? 'out_for_delivery' : 'booked',
        closed: 'Cancelled',
      };
  }
}

export interface TimelineEntry {
  label: string;
  /** ISO datetime; null when the contract carries no timestamp for the step. */
  at: string | null;
}

const REQUEST_ENDINGS: Record<Exclude<RentalRequestStatus, 'PENDING'>, string> = {
  ACCEPTED: 'Quote accepted — booked',
  REJECTED: 'Declined by supplier',
  CANCELLED: 'Cancelled by you',
  WITHDRAWN: 'Closed — another supplier was booked',
};

/**
 * Builds a request's history from the fields the contract has (there is no status log):
 * created → viewed → quote → final status at `updatedAt`.
 */
export function requestTimeline(
  request: Pick<
    RentalRequestDto,
    'status' | 'createdAt' | 'viewedAt' | 'latestQuote' | 'updatedAt'
  >,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ label: 'Request sent', at: request.createdAt }];
  if (request.viewedAt) entries.push({ label: 'Viewed by supplier', at: request.viewedAt });
  if (request.latestQuote && BUILDER_VISIBLE_QUOTES.includes(request.latestQuote.status)) {
    entries.push({ label: 'Quote received', at: null });
  }
  if (request.status !== 'PENDING') {
    entries.push({ label: REQUEST_ENDINGS[request.status], at: request.updatedAt });
  }
  return entries;
}

export function bookingTimeline(
  booking: Pick<
    BookingDto,
    'createdAt' | 'dispatchedAt' | 'rentStartedAt' | 'returnedAt' | 'cancelledAt' | 'cancelReason'
  >,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ label: 'Booking confirmed', at: booking.createdAt }];
  if (booking.dispatchedAt) entries.push({ label: 'Out for delivery', at: booking.dispatchedAt });
  if (booking.rentStartedAt) entries.push({ label: 'On rent', at: booking.rentStartedAt });
  if (booking.returnedAt) entries.push({ label: 'Returned', at: booking.returnedAt });
  if (booking.cancelledAt) {
    const reason = booking.cancelReason ? `: ${booking.cancelReason}` : '';
    entries.push({ label: `Cancelled${reason}`, at: booking.cancelledAt });
  }
  return entries;
}

export type StatusTone = 'neutral' | 'positive' | 'warning';

interface StatusLabel {
  label: string;
  tone: StatusTone;
}

export const REQUEST_STATUS: Record<RentalRequestStatus, StatusLabel> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  ACCEPTED: { label: 'Booked', tone: 'positive' },
  REJECTED: { label: 'Declined', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

export const QUOTE_STATUS: Record<QuoteStatus, StatusLabel> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Awaiting approval', tone: 'neutral' },
  SENT: { label: 'Awaiting your reply', tone: 'warning' },
  ACCEPTED: { label: 'Accepted', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

export const BOOKING_STATUS: Record<BookingStatus, StatusLabel> = {
  CONFIRMED: { label: 'Confirmed', tone: 'positive' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'warning' },
  ON_RENT: { label: 'On rent', tone: 'positive' },
  RETURNED: { label: 'Returned', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const REQUIREMENT_STATUS: Record<RequirementStatus, StatusLabel> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  OPEN: { label: 'Open', tone: 'warning' },
  AWARDED: { label: 'Awarded', tone: 'positive' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
