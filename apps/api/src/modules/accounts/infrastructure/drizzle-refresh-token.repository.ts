import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import { refreshTokens } from '../../../platform/database/schema';
import type { NewRefreshToken, RefreshTokenRepository } from '../domain';

@Injectable()
export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(token: NewRefreshToken): Promise<void> {
    await this.db.insert(refreshTokens).values(token);
  }

  async consume(tokenHash: string, now: Date): Promise<string | null> {
    // A single conditional UPDATE makes rotation race-safe: concurrent refreshes with the
    // same token can't both match `revoked_at IS NULL`.
    const [row] = await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now),
        ),
      )
      .returning({ accountId: refreshTokens.accountId });
    return row?.accountId ?? null;
  }

  async revoke(tokenHash: string, now: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }
}
