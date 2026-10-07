import { z } from 'zod';
import {
  calendarDateSchema,
  listingSummarySchema,
  pageSchema,
  paginationQuery,
  withRentalDateRules,
} from './common.js';
import { quoteSummarySchema, rentalRequestStatusSchema } from './statuses.js';

export const RENTAL_REQUEST_MESSAGE_MAX = 1000;
export const DECLINE_REASON_MAX = 500;

export const createRentalRequestSchema = withRentalDateRules(
  z
    .object({
      listingId: z.uuid(),
      startDate: calendarDateSchema,
      endDate: calendarDateSchema,
      message: z.string().trim().min(1).max(RENTAL_REQUEST_MESSAGE_MAX).optional(),
    })
    .strict(),
);
export type CreateRentalRequest = z.infer<typeof createRentalRequestSchema>;

export const listMyRentalRequestsQuerySchema = z.object({
  status: rentalRequestStatusSchema.optional(),
  ...paginationQuery,
});
export type ListMyRentalRequestsQuery = z.infer<typeof listMyRentalRequestsQuerySchema>;

export const listIncomingRentalRequestsQuerySchema = z.object({
  status: rentalRequestStatusSchema.optional(),
  listingId: z.uuid().optional(),
  ...paginationQuery,
});
export type ListIncomingRentalRequestsQuery = z.infer<typeof listIncomingRentalRequestsQuerySchema>;

export const rejectRentalRequestSchema = z
  .object({ reason: z.string().trim().min(1).max(DECLINE_REASON_MAX).optional() })
  .strict();
export type RejectRentalRequest = z.infer<typeof rejectRentalRequestSchema>;

export const rentalRequestSchema = z.object({
  id: z.uuid(),
  status: rentalRequestStatusSchema,
  requirementId: z.uuid().nullable(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  /** Rental length counting both the start and end date. */
  days: z.number().int(),
  message: z.string().nullable(),
  declineReason: z.string().nullable(),
  viewedAt: z.iso.datetime().nullable(),
  listing: listingSummarySchema,
  builderName: z.string(),
  supplierName: z.string(),
  latestQuote: quoteSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type RentalRequestDto = z.infer<typeof rentalRequestSchema>;

export const rentalRequestPageSchema = pageSchema(rentalRequestSchema);
export type RentalRequestPageDto = z.infer<typeof rentalRequestPageSchema>;
