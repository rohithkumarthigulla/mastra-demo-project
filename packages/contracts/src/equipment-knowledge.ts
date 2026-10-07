import { z } from 'zod';

export const unitSchema = z.enum(['kg', 't', 'm', 'mm', 'kW', 'hp', 'm3']);
export type Unit = z.infer<typeof unitSchema>;

export const specificationValueTypeSchema = z.enum(['NUMERIC', 'TEXT']);
export type SpecificationValueType = z.infer<typeof specificationValueTypeSchema>;

export const equipmentModelStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type EquipmentModelStatus = z.infer<typeof equipmentModelStatusSchema>;

export const specificationSourceTypeSchema = z.enum([
  'MANUFACTURER',
  'LICENSED_DATASET',
  'APPROVED_PUBLIC_SOURCE',
  'INTERNAL_VERIFICATION',
  'TEST_FIXTURE',
]);
export type SpecificationSourceType = z.infer<typeof specificationSourceTypeSchema>;

/** Only VERIFIED values are authoritative. */
export const verificationStatusSchema = z.enum([
  'VERIFIED',
  'REVIEW_REQUIRED',
  'UNKNOWN',
  'DEPRECATED',
]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const knowledgeCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]*$/, 'must be UPPER_SNAKE_CASE')
  .max(64);

const displayNameSchema = z.string().trim().min(1).max(120);

export const createEquipmentCategoryRequestSchema = z.object({
  code: knowledgeCodeSchema,
  displayName: displayNameSchema,
});
export type CreateEquipmentCategoryRequest = z.infer<typeof createEquipmentCategoryRequestSchema>;

export const createManufacturerRequestSchema = z.object({
  name: displayNameSchema,
});
export type CreateManufacturerRequest = z.infer<typeof createManufacturerRequestSchema>;

export const createSpecificationDefinitionRequestSchema = z
  .object({
    code: knowledgeCodeSchema,
    displayName: displayNameSchema,
    valueType: specificationValueTypeSchema,
    canonicalUnit: unitSchema.nullable().optional(),
  })
  .refine((d) => (d.valueType === 'NUMERIC') === (d.canonicalUnit != null), {
    message: 'canonicalUnit is required for NUMERIC definitions and forbidden for TEXT',
    path: ['canonicalUnit'],
  });
export type CreateSpecificationDefinitionRequest = z.infer<
  typeof createSpecificationDefinitionRequestSchema
>;

export const createEquipmentModelRequestSchema = z.object({
  manufacturerId: z.uuid(),
  categoryId: z.uuid(),
  modelName: displayNameSchema,
  modelCode: z.string().trim().min(1).max(64).nullable().optional(),
  status: equipmentModelStatusSchema.optional(),
});
export type CreateEquipmentModelRequest = z.infer<typeof createEquipmentModelRequestSchema>;

/** Which value shape is meant is inferred from which fields are set; the API enforces the rules. */
const specificationValueFields = {
  numericValue: z.number().nullable().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  unit: unitSchema.nullable().optional(),
  textValue: z.string().trim().min(1).max(500).nullable().optional(),
};

/** When omitted, status defaults from the value: REVIEW_REQUIRED if set, UNKNOWN if empty. */
const specificationVerificationFields = {
  verificationStatus: verificationStatusSchema.optional(),
  sourceId: z.uuid().nullable().optional(),
};

export const createSpecificationSourceRequestSchema = z.strictObject({
  sourceType: specificationSourceTypeSchema,
  sourceName: z.string().trim().min(1).max(200),
  referenceUrl: z.url().max(2000).nullable().optional(),
  documentName: z.string().trim().min(1).max(200).nullable().optional(),
  retrievedAt: z.iso.date().nullable().optional(),
  notes: z.string().trim().min(1).max(2000).nullable().optional(),
});
export type CreateSpecificationSourceRequest = z.infer<
  typeof createSpecificationSourceRequestSchema
>;

export const createEquipmentSpecificationRequestSchema = z.strictObject({
  definitionCode: knowledgeCodeSchema,
  ...specificationValueFields,
  ...specificationVerificationFields,
});
export type CreateEquipmentSpecificationRequest = z.infer<
  typeof createEquipmentSpecificationRequestSchema
>;

/**
 * Provided keys replace the current value (null clears it); omitted keys are kept.
 * If any value key is sent and verificationStatus is omitted, the status re-defaults
 * from the new value, so a changed value must be verified again.
 */
export const updateEquipmentSpecificationRequestSchema = z.strictObject({
  ...specificationValueFields,
  ...specificationVerificationFields,
});
export type UpdateEquipmentSpecificationRequest = z.infer<
  typeof updateEquipmentSpecificationRequestSchema
>;

export const MAX_PAGE_LIMIT = 200;

export const MAX_SPEC_FILTERS = 10;

const specFilterPattern = new RegExp(
  `^([A-Z][A-Z0-9_]*):(min|max):(\\d+(?:\\.\\d+)?):(${unitSchema.options.join('|')})$`,
);

/** `CODE:min|max:VALUE:UNIT`; `min` means at least, `max` means at most. */
export const specFilterSchema = z
  .string()
  .trim()
  .regex(
    specFilterPattern,
    'must look like CODE:min|max:VALUE:UNIT, e.g. MAX_DIGGING_DEPTH:min:5:m',
  )
  .transform((raw) => {
    const [, code, bound, value, unit] = specFilterPattern.exec(raw)!;
    return {
      code: code!,
      bound: bound as 'min' | 'max',
      value: Number(value),
      unit: unit as Unit,
    };
  });
export type SpecFilter = z.infer<typeof specFilterSchema>;

const searchTextSchema = z.string().trim().min(1).max(120);

/** Query strings give a string for one value and an array for repeats. */
const toArray = (value: unknown) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** All filters are optional and combined with AND. */
export const listEquipmentModelsQuerySchema = z.object({
  category: knowledgeCodeSchema.optional(),
  manufacturer: searchTextSchema.optional(),
  model: searchTextSchema.optional(),
  spec: z.preprocess(toArray, z.array(specFilterSchema).max(MAX_SPEC_FILTERS)),
  /** Only specifications with this status count towards `spec` filters. */
  verificationStatus: verificationStatusSchema.optional(),
  status: equipmentModelStatusSchema.default('ACTIVE'),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListEquipmentModelsQuery = z.infer<typeof listEquipmentModelsQuerySchema>;

export const equipmentCategorySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  displayName: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EquipmentCategoryDto = z.infer<typeof equipmentCategorySchema>;

export const manufacturerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ManufacturerDto = z.infer<typeof manufacturerSchema>;

export const specificationDefinitionSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  displayName: z.string(),
  valueType: specificationValueTypeSchema,
  canonicalUnit: unitSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SpecificationDefinitionDto = z.infer<typeof specificationDefinitionSchema>;

export const specificationSourceSchema = z.object({
  id: z.uuid(),
  sourceType: specificationSourceTypeSchema,
  sourceName: z.string(),
  referenceUrl: z.string().nullable(),
  documentName: z.string().nullable(),
  retrievedAt: z.iso.date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SpecificationSourceDto = z.infer<typeof specificationSourceSchema>;

export const equipmentSpecificationSchema = z.object({
  id: z.uuid(),
  modelId: z.uuid(),
  definitionCode: z.string(),
  numericValue: z.number().nullable(),
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
  unit: unitSchema.nullable(),
  textValue: z.string().nullable(),
  /** Value(s) converted to the definition's canonical unit; equal for a single value. */
  normalizedMin: z.number().nullable(),
  normalizedMax: z.number().nullable(),
  verificationStatus: verificationStatusSchema,
  verifiedAt: z.iso.datetime().nullable(),
  source: z
    .object({
      id: z.uuid(),
      sourceType: specificationSourceTypeSchema,
      sourceName: z.string(),
      referenceUrl: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EquipmentSpecificationDto = z.infer<typeof equipmentSpecificationSchema>;

export const equipmentModelSchema = z.object({
  id: z.uuid(),
  manufacturerId: z.uuid(),
  categoryId: z.uuid(),
  modelName: z.string(),
  modelCode: z.string().nullable(),
  status: equipmentModelStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EquipmentModelDto = z.infer<typeof equipmentModelSchema>;

export const equipmentModelDetailSchema = equipmentModelSchema.extend({
  specifications: z.array(equipmentSpecificationSchema),
});
export type EquipmentModelDetailDto = z.infer<typeof equipmentModelDetailSchema>;

export const equipmentModelPageSchema = z.object({
  items: z.array(equipmentModelSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  total: z.number().int(),
});
export type EquipmentModelPageDto = z.infer<typeof equipmentModelPageSchema>;
