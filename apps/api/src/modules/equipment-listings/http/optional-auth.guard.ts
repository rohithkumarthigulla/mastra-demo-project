import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { TokenService, type AuthenticatedRequest } from '../../../platform/auth';

/**
 * Like `AuthGuard`, but a missing or invalid token just means an anonymous viewer.
 * Used where signed-in owners can see more than the public.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme === 'Bearer' && token) {
      try {
        request.user = this.tokens.verifyAccessToken(token);
      } catch {
        request.user = undefined;
      }
    }
    return true;
  }
}
