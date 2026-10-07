import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform(
      (value) =>
        value
          ?.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean) ?? [],
    ),
  LISTING_MEDIA_DIR: z.string().min(1).default('./storage/listing-media'),
  LISTING_MEDIA_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(8 * 1024 * 1024),
  /** Without a key the API still starts; assistant endpoints answer 503. */
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  GEMINI_CHAT_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default('gemini-embedding-001'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  /** `fake` is a deterministic offline provider for tests and local demos. */
  AI_PROVIDER: z.enum(['gemini', 'fake']).default('gemini'),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  override readonly name = 'EnvError';
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new EnvError(`Invalid environment:\n${details}`);
  }
  return result.data;
}

export function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
