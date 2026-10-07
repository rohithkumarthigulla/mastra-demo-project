import type { BookingStatus, QuoteStatus, RentalRequestStatus, UnitStatus } from '@ee/contracts';
import { Badge, type BadgeTone } from '../ui';

type Style = { label: string; tone: BadgeTone };

const REQUEST: Record<RentalRequestStatus, Style> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  ACCEPTED: { label: 'Accepted', tone: 'positive' },
  REJECTED: { label: 'Declined', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

const QUOTE: Record<QuoteStatus, Style> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Awaiting approval', tone: 'warning' },
  SENT: { label: 'Sent', tone: 'warning' },
  ACCEPTED: { label: 'Accepted', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

const BOOKING: Record<BookingStatus, Style> = {
  CONFIRMED: { label: 'Confirmed', tone: 'positive' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'warning' },
  ON_RENT: { label: 'On rent', tone: 'positive' },
  RETURNED: { label: 'Returned', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

const UNIT: Record<UnitStatus, Style> = {
  ACTIVE: { label: 'Active', tone: 'positive' },
  RETIRED: { label: 'Retired', tone: 'neutral' },
};

export const REQUEST_STATUS_LABELS = labels(REQUEST);
export const QUOTE_STATUS_LABELS = labels(QUOTE);
export const BOOKING_STATUS_LABELS = labels(BOOKING);

function labels<T extends string>(map: Record<T, Style>): Record<T, string> {
  return Object.fromEntries(Object.entries<Style>(map).map(([k, v]) => [k, v.label])) as Record<
    T,
    string
  >;
}

export const RequestStatusBadge = ({ status }: { status: RentalRequestStatus }) => (
  <Badge {...REQUEST[status]} />
);
export const QuoteStatusBadge = ({ status }: { status: QuoteStatus }) => (
  <Badge {...QUOTE[status]} />
);
export const BookingStatusBadge = ({ status }: { status: BookingStatus }) => (
  <Badge {...BOOKING[status]} />
);
export const UnitStatusBadge = ({ status }: { status: UnitStatus }) => <Badge {...UNIT[status]} />;
