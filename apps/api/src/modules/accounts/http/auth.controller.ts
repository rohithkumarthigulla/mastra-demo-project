import type {} from '@fastify/cookie';
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  type AccountDto,
  type AuthResponse,
  type ClientKind,
  type LoginRequest,
  type LogoutRequest,
  type RefreshRequest,
  type RegisterRequest,
} from '@ee/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthGuard, CurrentUser, type AuthUser } from '../../../platform/auth';
import { ENV, type Env } from '../../../platform/config';
import { ZodValidationPipe } from '../../../platform/http';
import { AuthService, type AuthResult } from '../application';
import { InvalidRefreshTokenError, REFRESH_TOKEN_TTL_MS, type Account } from '../domain';

export const REFRESH_COOKIE = 'refresh_token';

function toAccountDto(account: Account): AccountDto {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    createdAt: account.createdAt.toISOString(),
  };
}

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    return this.respond(await this.auth.register(body), body.client, reply);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    return this.respond(await this.auth.login(body), body.client, reply);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const token = this.refreshTokenFrom(body, request);
    if (!token) throw new InvalidRefreshTokenError();
    return this.respond(await this.auth.refresh(token), body.client, reply);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(logoutRequestSchema)) body: LogoutRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = this.refreshTokenFrom(body, request);
    if (token) await this.auth.logout(token);
    if (body.client === 'web') reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: AuthUser): Promise<AccountDto> {
    return toAccountDto(await this.auth.me(user.accountId));
  }

  private refreshTokenFrom(body: RefreshRequest, request: FastifyRequest): string | undefined {
    return body.client === 'web' ? request.cookies[REFRESH_COOKIE] : body.refreshToken;
  }

  /** Web clients get the refresh token as an httpOnly cookie; native clients get it in the body. */
  private respond(result: AuthResult, client: ClientKind, reply: FastifyReply): AuthResponse {
    const response: AuthResponse = {
      account: toAccountDto(result.account),
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
    if (client === 'native') return { ...response, refreshToken: result.refreshToken };
    reply.setCookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: REFRESH_TOKEN_TTL_MS / 1000,
    });
    return response;
  }
}
