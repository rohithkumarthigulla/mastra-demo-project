import type { CalendarDate, QuoteStatus } from '@ee/contracts';

/** Statuses that hold the request's single open-quote slot and can still change. */
export const OPEN_QUOTE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'SENT'] as const;

/** Builders never see a quote before it is sent. */
export const BUILDER_VISIBLE_QUOTE_STATUSES = ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;

/** Quotes the supplier may still edit and send. */
export const EDITABLE_QUOTE_STATUSES = ['DRAFT', 'PENDING_APPROVAL'] as const;

/**
 * A sent quote past its `validUntil` date is EXPIRED when read, even before anything
 * persists that; there is no background job.
 */
export function effectiveQuoteStatus(
  status: QuoteStatus,
  validUntil: CalendarDate | null,
  today: CalendarDate,
): QuoteStatus {
  return status === 'SENT' && validUntil !== null && validUntil < today ? 'EXPIRED' : status;
}
