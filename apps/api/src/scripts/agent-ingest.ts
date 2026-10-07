import 'reflect-metadata';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AiModule } from '../modules/ai/ai.module';
import { AI_PROVIDER, type AiProvider } from '../modules/ai/domain';
import { ingestKnowledge } from '../modules/supplier-agent/application';
import { DrizzleKnowledgeRepository } from '../modules/supplier-agent/infrastructure';
import { readKnowledgeFiles } from '../modules/supplier-agent/infrastructure/knowledge-files';
import { ConfigModule, loadEnv } from '../platform/config';
import { DatabaseModule } from '../platform/database';

/** `docs/knowledge` at the repository root, unless a directory is passed as the first argument. */
const DEFAULT_ROOT = resolve(__dirname, '../../../../docs/knowledge');

async function main(): Promise<void> {
  const env = loadEnv();
  const root = resolve(process.argv[2] ?? DEFAULT_ROOT);

  @Module({
    imports: [ConfigModule.forRoot(env), DatabaseModule, AiModule],
    providers: [DrizzleKnowledgeRepository],
  })
  class IngestModule {}

  const app = await NestFactory.createApplicationContext(IngestModule, { logger: ['error'] });
  try {
    const sources = await readKnowledgeFiles(root);
    const summary = await ingestKnowledge(
      app.get(DrizzleKnowledgeRepository),
      app.get<AiProvider>(AI_PROVIDER),
      sources,
    );
    console.log(`Knowledge ingested from ${root}:`, summary);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
