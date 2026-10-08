import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../platform/config';
import {
  assertNotProduction,
  createDemoData,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  removeDemoData,
} from './demo-hyderabad-data';

async function main(): Promise<void> {
  const env = loadEnv();
  assertNotProduction(env);
  const remove = process.argv.includes('--remove');

  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    if (remove) {
      const removed = await removeDemoData(app);
      console.log(
        `Removed demo data: ${removed.accounts} accounts, ${removed.photos} photo files, ` +
          `${removed.specifications} demo specifications.`,
      );
      return;
    }
    const summary = await createDemoData(app);
    console.log(
      summary.created
        ? `Created Hyderabad demo data: ${summary.listings} listings, ${summary.units} machines, ` +
            `${summary.photos} photos, ${summary.requests} requests, ${summary.bookings} bookings, ` +
            `${summary.requirements} requirement.`
        : 'Demo data already present; nothing changed. Run with --remove first to recreate it.',
    );
    console.log('\nDemo accounts (local development only):');
    console.table(
      Object.values(DEMO_ACCOUNTS).map((a) => ({
        email: a.email,
        password: DEMO_PASSWORD,
        role: a.role,
        name: a.displayName,
      })),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
