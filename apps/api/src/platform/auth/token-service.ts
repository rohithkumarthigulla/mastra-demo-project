import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '../http';
import { CLOCK, type Clock } from './clock';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export class InvalidAccessTokenError extends DomainError {
  constructor() {
    super('invalid_token', 'Invalid or expired access token', 401);
  }
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  signAccessToken(accountId: string): { accessToken: string; expiresIn: number } {
    const accessToken = this.jwt.sign(
      { sub: accountId, iat: this.nowSeconds() },
      { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  verifyAccessToken(token: string): { accountId: string } {
    let payload: { sub?: unknown };
    try {
      payload = this.jwt.verify(token, {
        algorithms: ['HS256'],
        clockTimestamp: this.nowSeconds(),
      });
    } catch {
      throw new InvalidAccessTokenError();
    }
    if (typeof payload.sub !== 'string') throw new InvalidAccessTokenError();
    return { accountId: payload.sub };
  }

  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  /** Refresh tokens are 256-bit random values, so a fast hash is sufficient for storage. */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private nowSeconds(): number {
    return Math.floor(this.clock.now().getTime() / 1000);
  }
}
