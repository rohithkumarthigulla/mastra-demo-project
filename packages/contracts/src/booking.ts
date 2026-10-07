import { z } from 'zod';
import { calendarDateSchema, listingSummarySchema, pageSchema, paginationQuery } from './common.js';
import { bookingStatusSchema } from './statuses.js';

export const BOOKING_CANCEL_REASON_MAX = 500;

/** Statuses that hold the unit; two of these may never overlap on one unit. */
export const ACTIVE_BOOKING_STATUSES = ['CONFIRMED', 'OUT_FOR_DELIVERY', 'ON_RENT'] as const;

/** Statuses a booking may be cancelled from. */
export const CANCELLABLE_BOOKING_STATUSES = ['CONFIRMED', 'OUT_FOR_DELIVERY'] as const;

export const listBookingsQuerySchema = z.object({
  status: bookingStatusSchema.optional(),
  ...paginationQuery,
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;

export const cancelBookingSchema = z
  .object({ reason: z.string().trim().min(1).max(BOOKING_CANCEL_REASON_MAX) })
  .strict();
export type CancelBookingRequest = z.infer<typeof cancelBookingSchema>;

export const bookingSchema = z.object({
  id: z.uuid(),
  status: bookingStatusSchema,
  quoteId: z.uuid(),
  rentalRequestId: z.uuid(),
  equipmentUnitId: z.uuid(),
  /** Midnight at the start of `startDate` in Asia/Kolkata. */
  startAt: z.iso.datetime(),
  /** Midnight at the start of the day after `endDate` in Asia/Kolkata (exclusive). */
  endAt: z.iso.datetime(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  days: z.number().int(),
  total: z.number(),
  listing: listingSummarySchema,
  builderName: z.string(),
  supplierName: z.string(),
  dispatchedAt: z.iso.datetime().nullable(),
  rentStartedAt: z.iso.datetime().nullable(),
  returnedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BookingDto = z.infer<typeof bookingSchema>;

export const bookingPageSchema = pageSchema(bookingSchema);
export type BookingPageDto = z.infer<typeof bookingPageSchema>;
