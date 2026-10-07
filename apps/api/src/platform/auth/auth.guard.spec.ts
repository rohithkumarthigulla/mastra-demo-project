import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '../http';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';
import { systemClock } from './clock';
import { TokenService } from './token-service';

const tokens = new TokenService(
  new JwtService({ secret: 'test-secret-that-is-at-least-32-chars-long' }),
  systemClock,
);
const guard = new AuthGuard(tokens);

function context(authorization?: string) {
  const request = { headers: { authorization } } as AuthenticatedRequest;
  const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
  return { ctx, request };
}

function is401(error: unknown): boolean {
  assert.ok(error instanceof DomainError);
  assert.equal(error.status, 401);
  return true;
}

describe('AuthGuard', () => {
  it('sets request.user for a valid bearer token', () => {
    const { ctx, request } = context(`Bearer ${tokens.signAccessToken('acc-1').accessToken}`);
    assert.equal(guard.canActivate(ctx), true);
    assert.deepEqual(request.user, { accountId: 'acc-1' });
  });

  it('rejects a missing header, a non-bearer scheme, and an invalid token', () => {
    assert.throws(() => guard.canActivate(context().ctx), is401);
    assert.throws(() => guard.canActivate(context('Basic abc').ctx), is401);
    assert.throws(() => guard.canActivate(context('Bearer not.a.jwt').ctx), is401);
  });
});
