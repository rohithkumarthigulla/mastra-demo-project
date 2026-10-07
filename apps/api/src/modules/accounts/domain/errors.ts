import { ConflictError, DomainError } from '../../../platform/http';

export class EmailTakenError extends ConflictError {
  constructor() {
    super('email_taken', 'An account with this email already exists');
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('invalid_credentials', 'Invalid email or password', 401);
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super('invalid_refresh_token', 'Refresh token is invalid, expired, or already used', 401);
  }
}
