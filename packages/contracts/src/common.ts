import { z } from 'zod';

/** Largest `limit` any list endpoint accepts. */
export const MAX_LIST_LIMIT = 100;

/** Longest rental, in days, counting both the start and end date. */
export const MAX_RENTAL_DAYS = 365;

/** Rental dates are calendar days in this zone; bookings turn them into instants here. */
export const RENTAL_TIME_ZONE = 'Asia/Kolkata';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A real calendar date written as `YYYY-MM-DD`. */
export const calendarDateSchema = z.iso.date();
export type CalendarDate = z.infer<typeof calendarDateSchema>;

/** Today's calendar date in {@link RENTAL_TIME_ZONE}. */
export function todayInRentalZone(now: Date = new Date()): CalendarDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: RENTAL_TIME_ZONE }).format(now);
}

/** Days from `startDate` to `endDate`, both included. */
export function rentalDays(startDate: CalendarDate, endDate: CalendarDate): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS) + 1;
}

/** Adds the rental date rules to an object with `startDate` and `endDate`. */
export function withRentalDateRules<T extends { startDate: string; endDate: string }>(
  schema: z.ZodType<T>,
) {
  return schema
    .refine((v) => v.endDate >= v.startDate, {
      message: 'endDate must not be before startDate',
      path: ['endDate'],
    })
    .refine((v) => v.startDate >= todayInRentalZone(), {
      message: 'startDate must not be in the past',
      path: ['startDate'],
    })
    .refine((v) => rentalDays(v.startDate, v.endDate) <= MAX_RENTAL_DAYS, {
      message: `A rental is at most ${MAX_RENTAL_DAYS} days`,
      path: ['endDate'],
    });
}

export const paginationQuery = {
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

export const paginationQuerySchema = z.object(paginationQuery);
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  });
}

/** Body every stub route answers with until its feature is built. */
export const notImplementedSchema = z.object({
  code: z.literal('NOT_IMPLEMENTED'),
  message: z.string(),
});
export type NotImplementedBody = z.infer<typeof notImplementedSchema>;

/** Listing fields repeated on requests, quotes and bookings. */
export const listingSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  coverPhotoUrl: z.string().nullable(),
  city: z.string(),
  pricePerDay: z.number(),
});
export type ListingSummaryDto = z.infer<typeof listingSummarySchema>;
