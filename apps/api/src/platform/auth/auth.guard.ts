import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DomainError } from '../http';
import type { AuthUser } from './current-user.decorator';
import { TokenService } from './token-service';

export type AuthenticatedRequest = FastifyRequest & { user?: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new DomainError('unauthenticated', 'Authentication required', 401);
    }
    request.user = this.tokens.verifyAccessToken(token);
    return true;
  }
}
