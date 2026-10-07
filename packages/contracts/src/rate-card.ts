import { z } from 'zod';
import { rateSchema, rupeesSchema } from './money.js';

/** Optional pricing extras a supplier sets per listing; quotes are drafted from them. */
export const rateCardFields = {
  weekRate: rateSchema.nullable(),
  monthRate: rupeesSchema.nullable(),
  transportFee: rupeesSchema.nullable(),
  operatorRatePerDay: rateSchema.nullable(),
  depositAmount: rupeesSchema.nullable(),
};

/** Replaces the whole card: send `null` to clear an amount. */
export const putRateCardSchema = z.object(rateCardFields).strict();
export type PutRateCardRequest = z.infer<typeof putRateCardSchema>;

/** A listing with no card yet returns every amount as `null` and `updatedAt: null`. */
export const rateCardSchema = z.object({
  listingId: z.uuid(),
  weekRate: z.number().nullable(),
  monthRate: z.number().nullable(),
  transportFee: z.number().nullable(),
  operatorRatePerDay: z.number().nullable(),
  depositAmount: z.number().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});
export type RateCardDto = z.infer<typeof rateCardSchema>;
