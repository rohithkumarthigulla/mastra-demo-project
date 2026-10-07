import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EquipmentKnowledgeService } from '../modules/equipment-knowledge/application';
import { EquipmentKnowledgeModule } from '../modules/equipment-knowledge/equipment-knowledge.module';
import { ReferenceService } from '../modules/reference/application';
import { ReferenceModule } from '../modules/reference/reference.module';
import { seedReference } from '../modules/reference/seed/seed-reference';
import { AuthModule } from '../platform/auth';
import { ConfigModule, loadEnv } from '../platform/config';
import { DatabaseModule } from '../platform/database';
import { seedEquipmentKnowledge } from './seed-equipment-knowledge';
import { seedTaxonomy } from './seed-taxonomy';

async function main(): Promise<void> {
  const env = loadEnv();

  @Module({
    imports: [
      ConfigModule.forRoot(env),
      DatabaseModule,
      AuthModule,
      EquipmentKnowledgeModule,
      ReferenceModule,
    ],
  })
  class SeedModule {}

  const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error'] });
  try {
    const knowledge = app.get(EquipmentKnowledgeService);
    const created = await seedEquipmentKnowledge(knowledge);
    console.log('Equipment knowledge seeded. Rows created:', created);
    const taxonomy = await seedTaxonomy(knowledge);
    console.log('Equipment taxonomy seeded. Rows created:', taxonomy);
    const reference = await seedReference(app.get(ReferenceService));
    console.log('Reference data seeded. Rows created:', reference);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
