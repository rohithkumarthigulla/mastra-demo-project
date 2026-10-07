import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './application';
import { ACCOUNT_REPOSITORY, REFRESH_TOKEN_REPOSITORY } from './domain';
import { AuthController } from './http';
import { DrizzleAccountRepository, DrizzleRefreshTokenRepository } from './infrastructure';

/** Per-IP limit for every /auth route. In-memory, so it is per process. */
export const AUTH_RATE_LIMIT = { name: 'auth', ttl: 60_000, limit: 10 };

@Module({
  imports: [ThrottlerModule.forRoot([AUTH_RATE_LIMIT])],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: ACCOUNT_REPOSITORY, useClass: DrizzleAccountRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: DrizzleRefreshTokenRepository },
  ],
})
export class AccountsModule {}
