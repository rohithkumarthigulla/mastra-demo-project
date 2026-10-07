import { z } from 'zod';

export const blockReasonSchema = z.enum(['MAINTENANCE', 'TRANSPORT', 'HELD_BACK']);
export type BlockReason = z.infer<typeof blockReasonSchema>;

export const blockStatusSchema = z.enum(['ACTIVE', 'LIFTED']);
export type BlockStatus = z.infer<typeof blockStatusSchema>;

export const slotStateSchema = z.enum(['BLOCKED', 'BOOKED']);
export type SlotState = z.infer<typeof slotStateSchema>;

export const MAX_CALENDAR_DAYS = 92;
const DAY_MS = 24 * 60 * 60 * 1000;

const instantSchema = z.iso.datetime({ offset: true });

export const createBlockRequestSchema = z
  .object({
    reason: blockReasonSchema,
    startAt: instantSchema,
    endAt: instantSchema,
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((v) => Date.parse(v.endAt) > Date.parse(v.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });
export type CreateBlockRequest = z.infer<typeof createBlockRequestSchema>;

/** Half-open `[from, to)`, at most {@link MAX_CALENDAR_DAYS} days. */
export const calendarRangeQuerySchema = z
  .object({ from: instantSchema, to: instantSchema })
  .refine((v) => Date.parse(v.to) > Date.parse(v.from), {
    message: 'to must be after from',
    path: ['to'],
  })
  .refine((v) => Date.parse(v.to) - Date.parse(v.from) <= MAX_CALENDAR_DAYS * DAY_MS, {
    message: `Ask for at most ${MAX_CALENDAR_DAYS} days at a time`,
    path: ['to'],
  });
export type CalendarRangeQuery = z.infer<typeof calendarRangeQuerySchema>;

export const maintenanceBlockSchema = z.object({
  id: z.uuid(),
  unitId: z.uuid(),
  reason: blockReasonSchema,
  status: blockStatusSchema,
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MaintenanceBlockDto = z.infer<typeof maintenanceBlockSchema>;

export const blockedSlotSchema = z.object({
  state: z.literal('BLOCKED'),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  source: z.object({ type: z.literal('BLOCK'), id: z.uuid() }),
  reason: blockReasonSchema,
  note: z.string().nullable(),
});
export type BlockedSlotDto = z.infer<typeof blockedSlotSchema>;

/** A unit taken by a CONFIRMED, OUT_FOR_DELIVERY or ON_RENT booking. */
export const bookedSlotSchema = z.object({
  state: z.literal('BOOKED'),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  source: z.object({ type: z.literal('BOOKING'), id: z.uuid() }),
});
export type BookedSlotDto = z.infer<typeof bookedSlotSchema>;

export const calendarSlotSchema = z.discriminatedUnion('state', [
  blockedSlotSchema,
  bookedSlotSchema,
]);
export type CalendarSlotDto = z.infer<typeof calendarSlotSchema>;

export const unitCalendarSchema = z.object({
  unitId: z.uuid(),
  label: z.string().nullable(),
  yard: z.object({ id: z.uuid(), name: z.string() }),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  slots: z.array(calendarSlotSchema),
});
export type UnitCalendarDto = z.infer<typeof unitCalendarSchema>;

export const fleetCalendarSchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  lanes: z.array(unitCalendarSchema),
});
export type FleetCalendarDto = z.infer<typeof fleetCalendarSchema>;

export const listingAvailabilitySchema = z.object({
  totalUnits: z.number().int(),
  availableUnits: z.number().int(),
});
export type ListingAvailabilityDto = z.infer<typeof listingAvailabilitySchema>;
