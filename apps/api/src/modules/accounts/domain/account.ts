export interface Account {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface AccountWithPassword extends Account {
  passwordHash: string;
}

/** Strips private fields so they can't leak into responses. */
export function toAccount({ id, email, displayName, createdAt }: Account): Account {
  return { id, email, displayName, createdAt };
}

export interface NewAccount {
  email: string;
  passwordHash: string;
  displayName: string;
}

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export interface AccountRepository {
  /** `email` must already be normalised to lower case. */
  findByEmail(email: string): Promise<AccountWithPassword | null>;
  findById(id: string): Promise<Account | null>;
  /** Throws `EmailTakenError` if the email is already registered. */
  create(account: NewAccount): Promise<Account>;
}
