export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}
