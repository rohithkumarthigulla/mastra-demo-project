import { Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccountRole } from '@ee/contracts';
import { DomainError } from '../http';
import type { AuthenticatedRequest } from './auth.guard';

export const ROLES_KEY = 'roles';

/** Restricts a route or controller to the given roles. Pair with `@UseGuards(AuthGuard, RolesGuard)`. */
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AccountRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) return true;
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new DomainError('unauthenticated', 'Authentication required', 401);
    if (!roles.includes(user.role)) {
      throw new DomainError('forbidden', 'You do not have access to this resource', 403);
    }
    return true;
  }
}
