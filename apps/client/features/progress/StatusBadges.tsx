import type {
  BookingStatus,
  QuoteStatus,
  RentalRequestStatus,
  RequirementStatus,
} from '@ee/contracts';
import { Badge } from '../ui';
import { BOOKING_STATUS, QUOTE_STATUS, REQUEST_STATUS, REQUIREMENT_STATUS } from './stages';

export function RequestStatusBadge({ status }: { status: RentalRequestStatus }) {
  return <Badge {...REQUEST_STATUS[status]} />;
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge {...QUOTE_STATUS[status]} />;
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge {...BOOKING_STATUS[status]} />;
}

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return <Badge {...REQUIREMENT_STATUS[status]} />;
}
