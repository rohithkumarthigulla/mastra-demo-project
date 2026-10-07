import { z } from 'zod';
import { knowledgeCodeSchema } from './equipment-knowledge.js';
import { rateSchema, rupeesSchema } from './money.js';

export const MAX_LISTING_PAGE_LIMIT = 100;

export const listingStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']);
export type ListingStatus = z.infer<typeof listingStatusSchema>;

export const listingTitleSchema = z.string().trim().min(3).max(120);
export const listingDescriptionSchema = z.string().trim().min(10).max(2000);
export const listingLocationSchema = z.string().trim().min(2).max(160);
/** Daily price in rupees: above zero, at most the rate cap, two decimals. */
export const listingPricePerDaySchema = rateSchema.refine((value) => value > 0, {
  message: 'Price per day must be greater than 0',
});

export const createListingRequestSchema = z
  .object({
    modelId: z.uuid(),
    cityGeoId: z.string().trim().min(1),
    title: listingTitleSchema,
    description: listingDescriptionSchema,
    location: listingLocationSchema,
    pricePerDay: listingPricePerDaySchema,
  })
  .strict();
export type CreateListingRequest = z.infer<typeof createListingRequestSchema>;

export const updateListingRequestSchema = createListingRequestSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to change',
  });
export type UpdateListingRequest = z.infer<typeof updateListingRequestSchema>;

const pagination = {
  limit: z.coerce.number().int().min(1).max(MAX_LISTING_PAGE_LIMIT).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

export const listSupplierListingsQuerySchema = z.object({
  status: listingStatusSchema.optional(),
  ...pagination,
});
export type ListSupplierListingsQuery = z.infer<typeof listSupplierListingsQuerySchema>;

/** All filters are optional and combined with AND. Only ACTIVE listings are browsable. */
export const browseListingsQuerySchema = z
  .object({
    city: z.string().trim().min(1).optional(),
    category: knowledgeCodeSchema.optional(),
    modelId: z.uuid().optional(),
    manufacturer: z.uuid().optional(),
    minPrice: z.coerce.number().pipe(rupeesSchema).optional(),
    maxPrice: z.coerce.number().pipe(rupeesSchema).optional(),
    q: z.string().trim().min(1).max(120).optional(),
    ...pagination,
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: 'minPrice must not exceed maxPrice', path: ['minPrice'] },
  );
export type BrowseListingsQuery = z.infer<typeof browseListingsQuerySchema>;

export const listingPhotoSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  mimeType: z.string(),
  position: z.number().int(),
});
export type ListingPhotoDto = z.infer<typeof listingPhotoSchema>;

export const equipmentListingSchema = z.object({
  id: z.uuid(),
  status: listingStatusSchema,
  title: z.string(),
  description: z.string(),
  location: z.string(),
  pricePerDay: z.number(),
  model: z.object({
    id: z.uuid(),
    modelName: z.string(),
    manufacturer: z.object({ id: z.uuid(), name: z.string() }),
    category: z.object({ code: z.string(), displayName: z.string() }),
  }),
  city: z.object({ geoId: z.string(), name: z.string() }),
  supplier: z.object({ id: z.uuid(), displayName: z.string() }),
  /** Ordered by position; the first photo is the cover. */
  photos: z.array(listingPhotoSchema),
  coverPhotoUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EquipmentListingDto = z.infer<typeof equipmentListingSchema>;

export const equipmentListingPageSchema = z.object({
  items: z.array(equipmentListingSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type EquipmentListingPageDto = z.infer<typeof equipmentListingPageSchema>;
