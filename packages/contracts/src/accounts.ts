import { z } from 'zod';

export const clientKindSchema = z.enum(['web', 'native']);
export type ClientKind = z.infer<typeof clientKindSchema>;

export const accountRoleSchema = z.enum(['SUPPLIER', 'BUILDER', 'ADMIN']);
export type AccountRole = z.infer<typeof accountRoleSchema>;

/** Roles a user may pick at registration; ADMIN is operator-assigned only. */
export const registrableRoleSchema = z.enum(['SUPPLIER', 'BUILDER']);
export type RegistrableRole = z.infer<typeof registrableRoleSchema>;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(256),
  displayName: z.string().trim().min(1).max(100),
  role: registrableRoleSchema,
  client: clientKindSchema.default('native'),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
  client: clientKindSchema.default('native'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  client: clientKindSchema.default('native'),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const logoutRequestSchema = refreshRequestSchema;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;

export const accountSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  role: accountRoleSchema,
  createdAt: z.iso.datetime(),
});
export type AccountDto = z.infer<typeof accountSchema>;

export const authResponseSchema = z.object({
  account: accountSchema,
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
  refreshToken: z.string().optional(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
