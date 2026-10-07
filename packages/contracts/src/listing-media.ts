import { z } from 'zod';

export const MAX_LISTING_PHOTOS = 10;

export const LISTING_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const listingMediaMimeTypeSchema = z.enum(LISTING_MEDIA_MIME_TYPES);
export type ListingMediaMimeType = z.infer<typeof listingMediaMimeTypeSchema>;

/** Body of `PUT /supplier/listings/:id/media/order`: every current photo id, cover first. */
export const reorderListingMediaRequestSchema = z
  .object({ mediaIds: z.array(z.uuid()).max(MAX_LISTING_PHOTOS) })
  .strict();
export type ReorderListingMediaRequest = z.infer<typeof reorderListingMediaRequestSchema>;

export const listingMediaSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  originalFilename: z.string(),
  mimeType: listingMediaMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  position: z.number().int().min(0),
  createdAt: z.iso.datetime(),
});
export type ListingMediaDto = z.infer<typeof listingMediaSchema>;

export const listingMediaListSchema = z.object({ items: z.array(listingMediaSchema) });
export type ListingMediaListDto = z.infer<typeof listingMediaListSchema>;
