import { z } from 'zod';

export const unitConditionSchema = z.enum(['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR']);
export type UnitCondition = z.infer<typeof unitConditionSchema>;

export const unitStatusSchema = z.enum(['ACTIVE', 'RETIRED']);
export type UnitStatus = z.infer<typeof unitStatusSchema>;

export const assetIdentifierTypeSchema = z.enum([
  'SERIAL_NUMBER',
  'REGISTRATION_NUMBER',
  'ENGINE_NUMBER',
]);
export type AssetIdentifierType = z.infer<typeof assetIdentifierTypeSchema>;

export const yardNameSchema = z.string().trim().min(1).max(80);
export const yardAddressSchema = z.string().trim().max(300);

const nonEmpty = { message: 'Provide at least one field to change' };

export const createYardRequestSchema = z
  .object({
    name: yardNameSchema,
    cityGeoId: z.string().trim().min(1),
    address: yardAddressSchema,
  })
  .strict();
export type CreateYardRequest = z.infer<typeof createYardRequestSchema>;

export const updateYardRequestSchema = createYardRequestSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, nonEmpty);
export type UpdateYardRequest = z.infer<typeof updateYardRequestSchema>;

export const assetIdentifierSchema = z
  .object({
    type: assetIdentifierTypeSchema,
    value: z.string().trim().min(1).max(80),
  })
  .strict();
export type AssetIdentifier = z.infer<typeof assetIdentifierSchema>;

/** At most one identifier of each type. */
export const assetIdentifiersSchema = z
  .array(assetIdentifierSchema)
  .refine((items) => new Set(items.map((i) => i.type)).size === items.length, {
    message: 'Give each identifier type at most once',
  });

export const unitModelYearSchema = z.number().int().min(1950).max(2100);
export const unitLabelSchema = z.string().trim().min(1).max(80);

export const createUnitRequestSchema = z
  .object({
    listingId: z.uuid(),
    yardId: z.uuid(),
    modelYear: unitModelYearSchema,
    condition: unitConditionSchema,
    label: unitLabelSchema.optional(),
    identifiers: assetIdentifiersSchema.default([]),
  })
  .strict();
export type CreateUnitRequest = z.infer<typeof createUnitRequestSchema>;

/** `identifiers`, when sent, replaces the unit's whole set. `label: null` clears it. */
export const updateUnitRequestSchema = z
  .object({
    yardId: z.uuid().optional(),
    modelYear: unitModelYearSchema.optional(),
    condition: unitConditionSchema.optional(),
    label: unitLabelSchema.nullable().optional(),
    identifiers: assetIdentifiersSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, nonEmpty);
export type UpdateUnitRequest = z.infer<typeof updateUnitRequestSchema>;

export const listUnitsQuerySchema = z.object({
  listingId: z.uuid().optional(),
  yardId: z.uuid().optional(),
  status: unitStatusSchema.optional(),
});
export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>;

const citySchema = z.object({ geoId: z.string(), name: z.string() });

export const yardSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  city: citySchema,
  address: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type YardDto = z.infer<typeof yardSchema>;

export const equipmentUnitSchema = z.object({
  id: z.uuid(),
  listing: z.object({ id: z.uuid(), title: z.string() }),
  /** Always the listing's model; a unit does not store its own. */
  model: z.object({
    id: z.uuid(),
    modelName: z.string(),
    manufacturer: z.object({ id: z.uuid(), name: z.string() }),
  }),
  yard: z.object({ id: z.uuid(), name: z.string(), city: citySchema }),
  modelYear: z.number().int(),
  condition: unitConditionSchema,
  label: z.string().nullable(),
  status: unitStatusSchema,
  identifiers: z.array(assetIdentifierSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EquipmentUnitDto = z.infer<typeof equipmentUnitSchema>;
