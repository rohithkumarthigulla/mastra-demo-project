import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';

@Injectable()
export class DatabaseHealthCheck {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** True when the database is reachable and at least one migration has been applied. */
  async isReady(): Promise<boolean> {
    try {
      const result = await this.db.execute<{ n: number }>(
        sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
      );
      return (result.rows[0]?.n ?? 0) > 0;
    } catch {
      return false;
    }
  }
}
