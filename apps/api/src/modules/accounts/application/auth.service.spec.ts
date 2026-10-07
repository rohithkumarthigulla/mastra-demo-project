import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { PasswordHasher, TokenService, type Clock } from '../../../platform/auth';
import { DomainError } from '../../../platform/http';
import { REFRESH_TOKEN_TTL_MS } from '../domain';
import {
  InMemoryAccountRepository,
  InMemoryRefreshTokenRepository,
} from '../testing/in-memory-repositories';
import { AuthService } from './auth.service';

class FakeHasher extends PasswordHasher {
  override async hash(plain: string) {
    return `hashed:${plain}`;
  }
  override async verify(hash: string, plain: string) {
    return hash === `hashed:${plain}`;
  }
}

function setup() {
  let now = new Date('2026-01-01T00:00:00Z');
  const clock: Clock = { now: () => now };
  const accounts = new InMemoryAccountRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const tokens = new TokenService(
    new JwtService({ secret: 'test-secret-that-is-at-least-32-chars-long' }),
    clock,
  );
  const service = new AuthService(accounts, refreshTokens, new FakeHasher(), tokens, clock);
  return {
    service,
    tokens,
    accounts,
    refreshTokens,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

const input = { email: 'Ada@Example.com', password: 'password123', displayName: 'Ada' };

function hasCode(code: string, status: number) {
  return (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}

describe('AuthService', () => {
  it('registers with a lower-cased email and a hashed password', async () => {
    const { service, accounts, tokens } = setup();
    const result = await service.register(input);
    assert.equal(result.account.email, 'ada@example.com');
    assert.equal(accounts.rows[0]!.passwordHash, 'hashed:password123');
    assert.deepEqual(tokens.verifyAccessToken(result.accessToken), {
      accountId: result.account.id,
    });
    assert.ok(result.refreshToken);
  });

  it('rejects a duplicate email regardless of case with 409', async () => {
    const { service } = setup();
    await service.register(input);
    await assert.rejects(
      service.register({ ...input, email: 'ADA@example.COM' }),
      hasCode('email_taken', 409),
    );
  });

  it('logs in with any email casing and rejects bad credentials identically', async () => {
    const { service } = setup();
    const { account } = await service.register(input);
    assert.equal(
      (await service.login({ email: 'ADA@EXAMPLE.COM', password: 'password123' })).account.id,
      account.id,
    );
    await assert.rejects(
      service.login({ ...input, password: 'nope' }),
      hasCode('invalid_credentials', 401),
    );
    await assert.rejects(
      service.login({ email: 'ghost@example.com', password: 'password123' }),
      hasCode('invalid_credentials', 401),
    );
  });

  it('rotates refresh tokens and rejects the old one', async () => {
    const { service } = setup();
    const first = await service.register(input);
    const second = await service.refresh(first.refreshToken);
    assert.notEqual(second.refreshToken, first.refreshToken);
    await assert.rejects(
      service.refresh(first.refreshToken),
      hasCode('invalid_refresh_token', 401),
    );
    assert.ok(await service.refresh(second.refreshToken));
  });

  it('rejects expired and unknown refresh tokens', async () => {
    const { service, advance } = setup();
    const { refreshToken } = await service.register(input);
    advance(REFRESH_TOKEN_TTL_MS);
    await assert.rejects(service.refresh(refreshToken), hasCode('invalid_refresh_token', 401));
    await assert.rejects(service.refresh('garbage'), hasCode('invalid_refresh_token', 401));
  });

  it('logout revokes the refresh token and is idempotent', async () => {
    const { service } = setup();
    const { refreshToken } = await service.register(input);
    await service.logout(refreshToken);
    await service.logout(refreshToken);
    await assert.rejects(service.refresh(refreshToken), hasCode('invalid_refresh_token', 401));
  });

  it('me returns the account and 401s for an unknown id', async () => {
    const { service } = setup();
    const { account } = await service.register(input);
    assert.deepEqual(await service.me(account.id), account);
    await assert.rejects(
      service.me('00000000-0000-0000-0000-000000000000'),
      hasCode('invalid_token', 401),
    );
  });
});
