import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AccountRole } from '@ee/contracts';

export interface AuthUser {
  accountId: string;
  /** Role as of when the access token was issued; changes apply on the next refresh. */
  role: AccountRole;
}

/** The authenticated account; only populated on routes guarded by `AuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
