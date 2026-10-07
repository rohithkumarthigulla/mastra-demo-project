import { z } from 'zod';

export const citySchema = z.object({
  /** Stable code such as `IN-HYD`; never reused for another city. */
  geoId: z.string(),
  name: z.string(),
  state: z.string(),
  /** Whether the marketplace operates in this city yet. */
  enabled: z.boolean(),
});
export type CityDto = z.infer<typeof citySchema>;

export const entityTypeSchema = z.object({
  code: z.string(),
  name: z.string(),
});
export type EntityTypeDto = z.infer<typeof entityTypeSchema>;

export const publicReferenceSchema = z.object({
  cities: z.array(citySchema),
  entityTypes: z.array(entityTypeSchema),
});
export type PublicReferenceDto = z.infer<typeof publicReferenceSchema>;
