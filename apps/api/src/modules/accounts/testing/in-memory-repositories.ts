import { randomUUID } from 'node:crypto';
import {
  EmailTakenError,
  toAccount,
  type Account,
  type AccountRepository,
  type AccountWithPassword,
  type NewAccount,
  type NewRefreshToken,
  type RefreshTokenRepository,
} from '../domain';

export class InMemoryAccountRepository implements AccountRepository {
  readonly rows: AccountWithPassword[] = [];

  async findByEmail(email: string): Promise<AccountWithPassword | null> {
    return this.rows.find((a) => a.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<Account | null> {
    const row = this.rows.find((a) => a.id === id);
    return row ? toAccount(row) : null;
  }

  async create(input: NewAccount): Promise<Account> {
    if (await this.findByEmail(input.email)) throw new EmailTakenError();
    const row = { ...input, id: randomUUID(), createdAt: new Date() };
    this.rows.push(row);
    return toAccount(row);
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly rows: (NewRefreshToken & { revokedAt: Date | null })[] = [];

  async create(token: NewRefreshToken): Promise<void> {
    this.rows.push({ ...token, revokedAt: null });
  }

  async consume(tokenHash: string, now: Date): Promise<string | null> {
    const row = this.rows.find((r) => r.tokenHash === tokenHash);
    if (!row || row.revokedAt || row.expiresAt <= now) return null;
    row.revokedAt = now;
    return row.accountId;
  }

  async revoke(tokenHash: string, now: Date): Promise<void> {
    const row = this.rows.find((r) => r.tokenHash === tokenHash);
    if (row && !row.revokedAt) row.revokedAt = now;
  }
}
