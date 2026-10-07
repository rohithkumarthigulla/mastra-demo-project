import { z } from 'zod';

export const unitSchema = z.enum(['kg', 't', 'm', 'mm', 'kW', 'hp', 'm3']);
export type Unit = z.infer<typeof unitSchema>;

export const specificationValueTypeSchema = z.enum(['NUMERIC', 'TEXT']);
export type SpecificationValueType = z.infer<typeof specificationValueTypeSchema>;

export const equipmentModelStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type EquipmentModelStatus = z.infer<typeof equipmentModelStatusSchema>;

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

export const createEquipmentSpecificationRequestSchema = z.strictObject({
  definitionCode: knowledgeCodeSchema,
  ...specificationValueFields,
});
export type CreateEquipmentSpecificationRequest = z.infer<
  typeof createEquipmentSpecificationRequestSchema
>;

/** Provided keys replace the current value (null clears it); omitted keys are kept. */
export const updateEquipmentSpecificationRequestSchema = z.strictObject(specificationValueFields);
export type UpdateEquipmentSpecificationRequest = z.infer<
  typeof updateEquipmentSpecificationRequestSchema
>;

export const MAX_PAGE_LIMIT = 200;

export const listEquipmentModelsQuerySchema = z.object({
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
