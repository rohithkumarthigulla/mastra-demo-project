export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface NewRefreshToken {
  accountId: string;
  tokenHash: string;
  expiresAt: Date;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  create(token: NewRefreshToken): Promise<void>;
  /**
   * Atomically revokes the token if it is unrevoked and unexpired at `now`, returning its
   * account id. Returns null otherwise, so a token can be consumed at most once.
   */
  consume(tokenHash: string, now: Date): Promise<string | null>;
  /** Revokes the token if it is still active. No-op otherwise. */
  revoke(tokenHash: string, now: Date): Promise<void>;
}
