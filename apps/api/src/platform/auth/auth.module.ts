import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV, type Env } from '../config';
import { AuthGuard } from './auth.guard';
import { CLOCK, systemClock } from './clock';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token-service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [{ provide: CLOCK, useValue: systemClock }, PasswordHasher, TokenService, AuthGuard],
  exports: [CLOCK, PasswordHasher, TokenService, AuthGuard],
})
export class AuthModule {}
