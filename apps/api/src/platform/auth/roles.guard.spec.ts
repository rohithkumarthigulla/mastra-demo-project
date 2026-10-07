import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccountRole } from '@ee/contracts';
import { DomainError } from '../http';
import type { AuthUser } from './current-user.decorator';
import { Roles, RolesGuard } from './roles.guard';

class Controller {
  @Roles('SUPPLIER')
  supplierOnly() {}

  open() {}
}

const guard = new RolesGuard(new Reflector());

function context(handler: keyof Controller, user?: AuthUser) {
  return {
    getHandler: () => Controller.prototype[handler],
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function hasStatus(status: number) {
  return (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, status);
    return true;
  };
}

const as = (role: AccountRole): AuthUser => ({ accountId: 'acc-1', role });

describe('RolesGuard', () => {
  it('allows a user with a required role', () => {
    assert.equal(guard.canActivate(context('supplierOnly', as('SUPPLIER'))), true);
  });

  it('returns 403 for a signed-in user without the role', () => {
    assert.throws(() => guard.canActivate(context('supplierOnly', as('BUILDER'))), hasStatus(403));
    assert.throws(() => guard.canActivate(context('supplierOnly', as('ADMIN'))), hasStatus(403));
  });

  it('returns 401 when no user is on the request', () => {
    assert.throws(() => guard.canActivate(context('supplierOnly')), hasStatus(401));
  });

  it('allows routes without @Roles', () => {
    assert.equal(guard.canActivate(context('open')), true);
  });
});
