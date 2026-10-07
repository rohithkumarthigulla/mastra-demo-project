import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB, isUniqueViolation, type Database } from '../../../platform/database';
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
  role: accounts.role,
  createdAt: accounts.createdAt,
};

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
