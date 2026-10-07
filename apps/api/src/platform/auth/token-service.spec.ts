import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import type { Clock } from './clock';
import { ACCESS_TOKEN_TTL_SECONDS, InvalidAccessTokenError, TokenService } from './token-service';

const SECRET = 'test-secret-that-is-at-least-32-chars-long';
const user = { accountId: 'acc-1', role: 'SUPPLIER' } as const;

function setup(start = new Date('2026-01-01T00:00:00Z')) {
  let now = start;
  const clock: Clock = { now: () => now };
  const service = new TokenService(new JwtService({ secret: SECRET }), clock);
  return { service, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

function isInvalidToken(error: unknown): boolean {
  assert.ok(error instanceof InvalidAccessTokenError);
  assert.equal(error.status, 401);
  return true;
}

describe('TokenService', () => {
  it('signs an access token that verifies back to the account id', () => {
    const { service } = setup();
    const { accessToken, expiresIn } = service.signAccessToken(user);
    assert.equal(expiresIn, ACCESS_TOKEN_TTL_SECONDS);
    assert.deepEqual(service.verifyAccessToken(accessToken), user);
  });

  it('rejects a token once 15 minutes have passed', () => {
    const { service, advance } = setup();
    const { accessToken } = service.signAccessToken(user);
    advance(15 * 60 * 1000 - 1000);
    assert.deepEqual(service.verifyAccessToken(accessToken), user);
    advance(1000);
    assert.throws(() => service.verifyAccessToken(accessToken), isInvalidToken);
  });

  it('rejects a tampered signature', () => {
    const { service } = setup();
    const { accessToken } = service.signAccessToken(user);
    const last = accessToken.at(-2) === 'A' ? 'B' : 'A';
    const tampered = accessToken.slice(0, -2) + last + accessToken.slice(-1);
    assert.throws(() => service.verifyAccessToken(tampered), isInvalidToken);
  });

  it('rejects a tampered payload', () => {
    const { service } = setup();
    const [header, , signature] = service.signAccessToken(user).accessToken.split('.');
    const payload = Buffer.from(JSON.stringify({ sub: 'acc-2' })).toString('base64url');
    assert.throws(
      () => service.verifyAccessToken(`${header}.${payload}.${signature}`),
      isInvalidToken,
    );
  });

  it('rejects a validly signed token with a missing or unknown role', () => {
    const { service } = setup();
    const jwt = new JwtService({ secret: SECRET });
    assert.throws(() => service.verifyAccessToken(jwt.sign({ sub: 'acc-1' })), isInvalidToken);
    assert.throws(
      () => service.verifyAccessToken(jwt.sign({ sub: 'acc-1', role: 'ROOT' })),
      isInvalidToken,
    );
  });

  it('rejects a token signed with another secret', () => {
    const { service } = setup();
    const other = new JwtService({ secret: 'another-secret-that-is-also-32-chars-long' });
    assert.throws(() => service.verifyAccessToken(other.sign({ sub: 'acc-1' })), isInvalidToken);
  });

  it('rejects an unsigned (alg: none) token', () => {
    const { service } = setup();
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'acc-1' })}.`;
    assert.throws(() => service.verifyAccessToken(token), isInvalidToken);
  });

  it('generates unique refresh tokens with a deterministic hash', () => {
    const { service } = setup();
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();
    assert.notEqual(a.token, b.token);
    assert.notEqual(a.hash, a.token);
    assert.equal(service.hashRefreshToken(a.token), a.hash);
  });
});
