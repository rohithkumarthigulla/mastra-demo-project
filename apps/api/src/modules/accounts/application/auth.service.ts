import { Inject, Injectable } from '@nestjs/common';
import {
  CLOCK,
  InvalidAccessTokenError,
  PasswordHasher,
  TokenService,
  type Clock,
} from '../../../platform/auth';
import {
  ACCOUNT_REPOSITORY,
  EmailTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  REFRESH_TOKEN_REPOSITORY,
  REFRESH_TOKEN_TTL_MS,
  toAccount,
  type Account,
  type AccountRepository,
  type RefreshTokenRepository,
} from '../domain';

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface AuthResult extends IssuedTokens {
  account: Account;
}

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    if (await this.accounts.findByEmail(email)) throw new EmailTakenError();
    const account = await this.accounts.create({
      email,
      passwordHash: await this.hasher.hash(input.password),
      displayName: input.displayName,
    });
    return { account, ...(await this.issueTokens(account.id)) };
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const found = await this.accounts.findByEmail(input.email.toLowerCase());
    // Verify against a dummy hash for unknown emails so timing doesn't reveal which accounts exist.
    const hash = found?.passwordHash ?? (await this.getDummyHash());
    const valid = await this.hasher.verify(hash, input.password);
    if (!found || !valid) throw new InvalidCredentialsError();
    const account = toAccount(found);
    return { account, ...(await this.issueTokens(account.id)) };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const accountId = await this.refreshTokens.consume(
      this.tokens.hashRefreshToken(refreshToken),
      this.clock.now(),
    );
    if (!accountId) throw new InvalidRefreshTokenError();
    const account = await this.accounts.findById(accountId);
    if (!account) throw new InvalidRefreshTokenError();
    return { account, ...(await this.issueTokens(account.id)) };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.revoke(this.tokens.hashRefreshToken(refreshToken), this.clock.now());
  }

  async me(accountId: string): Promise<Account> {
    const account = await this.accounts.findById(accountId);
    if (!account) throw new InvalidAccessTokenError();
    return account;
  }

  private async issueTokens(accountId: string): Promise<IssuedTokens> {
    const { accessToken, expiresIn } = this.tokens.signAccessToken(accountId);
    const { token, hash } = this.tokens.generateRefreshToken();
    await this.refreshTokens.create({
      accountId,
      tokenHash: hash,
      expiresAt: new Date(this.clock.now().getTime() + REFRESH_TOKEN_TTL_MS),
    });
    return { accessToken, expiresIn, refreshToken: token };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('dummy-password-for-timing-equalisation');
    return this.dummyHash;
  }
}
