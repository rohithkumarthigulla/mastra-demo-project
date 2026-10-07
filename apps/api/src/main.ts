import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { loadEnv } from './platform/config';
import { AllExceptionsFilter } from './platform/http';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(env),
    new FastifyAdapter(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  if (env.CORS_ORIGINS.length > 0) app.enableCors({ origin: env.CORS_ORIGINS });
  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
