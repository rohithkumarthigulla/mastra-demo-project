import { z } from 'zod';
import { calendarDateSchema, listingSummarySchema, pageSchema, paginationQuery } from './common.js';
import { rateSchema, rupeesSchema } from './money.js';
import { quoteStatusSchema, rentalRequestStatusSchema } from './statuses.js';

/**
 * Tax on the quote subtotal, in percent.
 *
 * Totals (computed by the api, never sent by clients):
 * - subtotal = sum of every line except `DEPOSIT`, with `DISCOUNT` lines counted negative
 * - tax = {@link QUOTE_TAX_PERCENT}% of subtotal; the deposit is never taxed
 * - total = subtotal + tax + deposit
 */
export const QUOTE_TAX_PERCENT = 18;

export const QUOTE_NOTES_MAX = 2000;
export const QUOTE_MAX_LINES = 20;

export const quoteLineTypeSchema = z.enum([
  'RENTAL',
  'TRANSPORT',
  'OPERATOR',
  'DEPOSIT',
  'DISCOUNT',
]);
export type QuoteLineType = z.infer<typeof quoteLineTypeSchema>;

/**
 * One priced line as the supplier enters it. `unitAmount` is always positive; a
 * `DISCOUNT` line is subtracted because of its type, not its sign.
 */
export const quoteLineInputSchema = z
  .object({
    type: quoteLineTypeSchema,
    description: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(366),
    unitAmount: rateSchema,
  })
  .strict();
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;

const quoteLinesSchema = z.array(quoteLineInputSchema).min(1).max(QUOTE_MAX_LINES);
const quoteNotesSchema = z.string().trim().min(1).max(QUOTE_NOTES_MAX);

export const createQuoteSchema = z
  .object({
    rentalRequestId: z.uuid(),
    equipmentUnitId: z.uuid().optional(),
    lines: quoteLinesSchema,
    notes: quoteNotesSchema.optional(),
    validUntil: calendarDateSchema.optional(),
  })
  .strict();
export type CreateQuoteRequest = z.infer<typeof createQuoteSchema>;

/** Only allowed while the quote is `DRAFT` or `PENDING_APPROVAL`. */
export const updateQuoteSchema = z
  .object({
    equipmentUnitId: z.uuid().nullable(),
    lines: quoteLinesSchema,
    notes: quoteNotesSchema.nullable(),
    validUntil: calendarDateSchema.nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to change',
  });
export type UpdateQuoteRequest = z.infer<typeof updateQuoteSchema>;

export const rejectQuoteSchema = z
  .object({ reason: z.string().trim().min(1).max(500).optional() })
  .strict();
export type RejectQuoteRequest = z.infer<typeof rejectQuoteSchema>;

export const listQuotesQuerySchema = z.object({
  status: quoteStatusSchema.optional(),
  ...paginationQuery,
});
export type ListQuotesQuery = z.infer<typeof listQuotesQuerySchema>;

export const quoteLineSchema = z.object({
  id: z.uuid(),
  type: quoteLineTypeSchema,
  description: z.string(),
  quantity: z.number().int(),
  unitAmount: rupeesSchema,
  /** quantity × unitAmount, negative for `DISCOUNT`. */
  amount: z.number(),
  position: z.number().int(),
});
export type QuoteLineDto = z.infer<typeof quoteLineSchema>;

export const quoteSchema = z.object({
  id: z.uuid(),
  status: quoteStatusSchema,
  equipmentUnitId: z.uuid().nullable(),
  lines: z.array(quoteLineSchema),
  subtotal: z.number(),
  taxPercent: z.number(),
  taxAmount: z.number(),
  depositAmount: z.number(),
  total: z.number(),
  notes: z.string().nullable(),
  validUntil: calendarDateSchema.nullable(),
  autoDrafted: z.boolean(),
  sentAt: z.iso.datetime().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  rentalRequest: z.object({
    id: z.uuid(),
    status: rentalRequestStatusSchema,
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
    days: z.number().int(),
    requirementId: z.uuid().nullable(),
  }),
  listing: listingSummarySchema,
  builderName: z.string(),
  supplierName: z.string(),
  /** Set once the quote is accepted. */
  bookingId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type QuoteDto = z.infer<typeof quoteSchema>;

export const quotePageSchema = pageSchema(quoteSchema);
export type QuotePageDto = z.infer<typeof quotePageSchema>;
