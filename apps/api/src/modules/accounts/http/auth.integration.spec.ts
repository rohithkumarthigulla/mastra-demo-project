import 'reflect-metadata';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard, CLOCK, PasswordHasher, TokenService, type Clock } from '../../../platform/auth';
import { ConfigModule, parseEnv } from '../../../platform/config';
import { configureApp } from '../../../platform/http';
import { AUTH_RATE_LIMIT } from '../accounts.module';
import { AuthService } from '../application';
import { ACCOUNT_REPOSITORY, REFRESH_TOKEN_REPOSITORY } from '../domain';
import {
  InMemoryAccountRepository,
  InMemoryRefreshTokenRepository,
} from '../testing/in-memory-repositories';
import { AuthController, REFRESH_COOKIE } from './auth.controller';

const env = parseEnv({
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
});

class FakeHasher extends PasswordHasher {
  override async hash(plain: string) {
    return `hashed:${plain}`;
  }
  override async verify(hash: string, plain: string) {
    return hash === `hashed:${plain}`;
  }
}

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function createApp() {
  let now = new Date('2026-01-01T00:00:00Z');
  const clock: Clock = { now: () => now };

  @Module({
    imports: [
      ConfigModule.forRoot(env),
      JwtModule.register({ secret: env.JWT_SECRET }),
      ThrottlerModule.forRoot([AUTH_RATE_LIMIT]),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      TokenService,
      AuthGuard,
      { provide: PasswordHasher, useClass: FakeHasher },
      { provide: CLOCK, useValue: clock },
      { provide: ACCOUNT_REPOSITORY, useValue: new InMemoryAccountRepository() },
      { provide: REFRESH_TOKEN_REPOSITORY, useValue: new InMemoryRefreshTokenRepository() },
    ],
  })
  class TestModule {}

  app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), {
    logger: false,
  });
  await configureApp(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const server = app;

  return {
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
    post: (
      url: string,
      payload: object,
      opts: { cookies?: Record<string, string>; ip?: string } = {},
    ) =>
      server.inject({
        method: 'POST',
        url,
        payload,
        cookies: opts.cookies,
        remoteAddress: opts.ip,
      }),
    me: (token: string) =>
      server.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      }),
  };
}

const credentials = { email: 'ada@example.com', password: 'password123' };
const registration = { ...credentials, displayName: 'Ada' };

describe('auth HTTP (native clients)', () => {
  it('register → me → login → refresh → logout', async () => {
    const http = await createApp();

    const registered = await http.post('/auth/register', registration);
    assert.equal(registered.statusCode, 201);
    const reg = registered.json();
    assert.equal(reg.account.email, 'ada@example.com');
    assert.equal(reg.expiresIn, 900);
    assert.ok(reg.refreshToken);
    assert.equal(registered.cookies.length, 0);

    const me = await http.me(reg.accessToken);
    assert.equal(me.statusCode, 200);
    assert.deepEqual(me.json(), reg.account);

    const login = await http.post('/auth/login', { ...credentials, email: 'ADA@example.com' });
    assert.equal(login.statusCode, 200);

    const refreshed = await http.post('/auth/refresh', { refreshToken: login.json().refreshToken });
    assert.equal(refreshed.statusCode, 200);
    assert.notEqual(refreshed.json().refreshToken, login.json().refreshToken);

    const logout = await http.post('/auth/logout', { refreshToken: refreshed.json().refreshToken });
    assert.equal(logout.statusCode, 204);
    const afterLogout = await http.post('/auth/refresh', {
      refreshToken: refreshed.json().refreshToken,
    });
    assert.equal(afterLogout.statusCode, 401);
  });

  it('returns 409 for a duplicate email in any casing', async () => {
    const http = await createApp();
    await http.post('/auth/register', registration);
    const dup = await http.post('/auth/register', { ...registration, email: 'Ada@Example.COM' });
    assert.equal(dup.statusCode, 409);
    assert.equal(dup.json().code, 'email_taken');
  });

  it('validates input with 400', async () => {
    const http = await createApp();
    const res = await http.post('/auth/register', {
      ...registration,
      password: 'short',
      email: 'nope',
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().code, 'validation_failed');
  });

  it('rejects wrong passwords and unknown emails with the same 401', async () => {
    const http = await createApp();
    await http.post('/auth/register', registration);
    const wrong = await http.post('/auth/login', { ...credentials, password: 'wrong-password' });
    const unknown = await http.post('/auth/login', { ...credentials, email: 'ghost@example.com' });
    assert.equal(wrong.statusCode, 401);
    assert.deepEqual(wrong.json(), unknown.json());
  });

  it('rejects a refresh token after it has been rotated', async () => {
    const http = await createApp();
    const { refreshToken } = (await http.post('/auth/register', registration)).json();
    assert.equal((await http.post('/auth/refresh', { refreshToken })).statusCode, 200);
    const reused = await http.post('/auth/refresh', { refreshToken });
    assert.equal(reused.statusCode, 401);
    assert.equal(reused.json().code, 'invalid_refresh_token');
  });

  it('returns 401 from /auth/me after 15 minutes, for a tampered token, and without a token', async () => {
    const http = await createApp();
    const { accessToken } = (await http.post('/auth/register', registration)).json();

    const [header, , signature] = accessToken.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'someone-else' })).toString('base64url');
    assert.equal((await http.me(`${header}.${forged}.${signature}`)).statusCode, 401);
    assert.equal((await app!.inject({ method: 'GET', url: '/auth/me' })).statusCode, 401);

    http.advance(14 * 60 * 1000);
    assert.equal((await http.me(accessToken)).statusCode, 200);
    http.advance(60 * 1000);
    const expired = await http.me(accessToken);
    assert.equal(expired.statusCode, 401);
    assert.equal(expired.json().code, 'invalid_token');
  });
});

describe('auth HTTP (web clients)', () => {
  it('uses an httpOnly cookie for the refresh token and clears it on logout', async () => {
    const http = await createApp();
    const registered = await http.post('/auth/register', { ...registration, client: 'web' });
    assert.equal(registered.statusCode, 201);
    assert.equal(registered.json().refreshToken, undefined);
    const cookie = registered.cookies.find((c) => c.name === REFRESH_COOKIE);
    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Lax');
    assert.equal(cookie.path, '/auth');

    const refreshed = await http.post(
      '/auth/refresh',
      { client: 'web' },
      { cookies: { [REFRESH_COOKIE]: cookie.value } },
    );
    assert.equal(refreshed.statusCode, 200);
    const rotated = refreshed.cookies.find((c) => c.name === REFRESH_COOKIE)!;
    assert.notEqual(rotated.value, cookie.value);

    const logout = await http.post(
      '/auth/logout',
      { client: 'web' },
      { cookies: { [REFRESH_COOKIE]: rotated.value } },
    );
    assert.equal(logout.statusCode, 204);
    const cleared = logout.cookies.find((c) => c.name === REFRESH_COOKIE)!;
    assert.equal(cleared.value, '');

    const after = await http.post(
      '/auth/refresh',
      { client: 'web' },
      { cookies: { [REFRESH_COOKIE]: rotated.value } },
    );
    assert.equal(after.statusCode, 401);
  });

  it('returns 401 when a web refresh has no cookie', async () => {
    const http = await createApp();
    assert.equal((await http.post('/auth/refresh', { client: 'web' })).statusCode, 401);
  });
});

describe('auth HTTP rate limiting', () => {
  it('returns 429 on the 11th request within 60s from one IP, per IP', async () => {
    const http = await createApp();
    for (let i = 0; i < 10; i++) {
      const res = await http.post('/auth/login', credentials, { ip: '10.0.0.1' });
      assert.equal(res.statusCode, 401, `request ${i + 1}`);
    }
    const limited = await http.post('/auth/login', credentials, { ip: '10.0.0.1' });
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.json().code, 'too_many_requests');

    const otherIp = await http.post('/auth/register', registration, { ip: '10.0.0.2' });
    assert.equal(otherIp.statusCode, 201);
  });
});
