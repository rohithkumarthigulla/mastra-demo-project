import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from '../config';
import { AllExceptionsFilter } from './http-exception.filter';

/** App-level HTTP setup shared by `main.ts` and in-process integration tests. */
export async function configureApp(app: NestFastifyApplication, env: Env): Promise<void> {
  await app.register(fastifyCookie);
  // One file per request and no text fields: only listing photo uploads use multipart.
  await app.register(fastifyMultipart, {
    limits: { fileSize: env.LISTING_MEDIA_MAX_BYTES, files: 1, fields: 0 },
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  // Credentials are required so browsers send the httpOnly refresh-token cookie cross-origin.
  if (env.CORS_ORIGINS.length > 0) app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
}
