import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import { accounts } from '../../../platform/database/schema';
import {
  EmailTakenError,
  type Account,
  type AccountRepository,
  type AccountWithPassword,
  type NewAccount,
} from '../domain';

const publicColumns = {
  id: accounts.id,
  email: accounts.email,
  displayName: accounts.displayName,
  createdAt: accounts.createdAt,
};

/** Postgres unique_violation; drizzle may wrap the driver error in `cause`. */
function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === '23505') return true;
  }
  return false;
}

@Injectable()
export class DrizzleAccountRepository implements AccountRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findByEmail(email: string): Promise<AccountWithPassword | null> {
    const [row] = await this.db
      .select({ ...publicColumns, passwordHash: accounts.passwordHash })
      .from(accounts)
      .where(eq(sql`lower(${accounts.email})`, email.toLowerCase()))
      .limit(1);
    return row ?? null;
  }

  async findById(id: string): Promise<Account | null> {
    const [row] = await this.db
      .select(publicColumns)
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);
    return row ?? null;
  }

  async create(account: NewAccount): Promise<Account> {
    try {
      const [row] = await this.db.insert(accounts).values(account).returning(publicColumns);
      return row!;
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailTakenError();
      throw error;
    }
  }
}
