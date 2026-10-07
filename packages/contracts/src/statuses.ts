import { z } from 'zod';

// Lifecycle enums live together because requests, quotes, bookings and requirements
// all embed summaries of each other; keeping them here avoids import cycles.

/**
 * `CANCELLED`: the builder cancelled. `WITHDRAWN`: closed by the system because the
 * builder accepted another supplier's quote for the same requirement.
 */
export const rentalRequestStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'WITHDRAWN',
]);
export type RentalRequestStatus = z.infer<typeof rentalRequestStatusSchema>;

export const quoteStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export const bookingStatusSchema = z.enum([
  'CONFIRMED',
  'OUT_FOR_DELIVERY',
  'ON_RENT',
  'RETURNED',
  'CANCELLED',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const requirementStatusSchema = z.enum(['DRAFT', 'OPEN', 'AWARDED', 'CANCELLED']);
export type RequirementStatus = z.infer<typeof requirementStatusSchema>;

/** The quote fields shown wherever a request or invitation is listed. */
export const quoteSummarySchema = z.object({
  id: z.uuid(),
  status: quoteStatusSchema,
  total: z.number(),
});
export type QuoteSummaryDto = z.infer<typeof quoteSummarySchema>;
