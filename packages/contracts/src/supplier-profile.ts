import { z } from 'zod';

export const supplierDisplayNameSchema = z.string().trim().min(2).max(120);

export const createSupplierProfileRequestSchema = z.object({
  displayName: supplierDisplayNameSchema,
});
export type CreateSupplierProfileRequest = z.infer<typeof createSupplierProfileRequestSchema>;

export const updateSupplierProfileRequestSchema = z.object({
  displayName: supplierDisplayNameSchema,
});
export type UpdateSupplierProfileRequest = z.infer<typeof updateSupplierProfileRequestSchema>;

export const supplierProfileSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  displayName: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SupplierProfileDto = z.infer<typeof supplierProfileSchema>;
