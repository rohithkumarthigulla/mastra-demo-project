import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.url(),
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
