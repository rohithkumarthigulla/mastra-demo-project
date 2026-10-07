import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/platform/database/schema.ts',
  out: './drizzle',
  migrations: { table: '__drizzle_migrations', schema: 'drizzle' },
  dbCredentials: {
    // Dev-only fallback so migrations run against docker-compose without a .env file.
    url: process.env.DATABASE_URL ?? 'postgres://ee:ee@localhost:5432/ee',
  },
});
