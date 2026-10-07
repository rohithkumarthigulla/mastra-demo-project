import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  accountId: string;
}

/** The authenticated account; only populated on routes guarded by `AuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
