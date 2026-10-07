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

/** Route is registered with its final path, roles and validation, but has no handler yet. */
export class NotImplementedError extends DomainError {
  constructor() {
    super('NOT_IMPLEMENTED', 'This endpoint is not implemented yet', 501);
  }
}

/**
 * Body of a stub handler. Takes the validated inputs so stubs keep their final signature
 * and the pipes still run (400 on bad input) until the real handler replaces it.
 */
export function notImplemented(...inputs: unknown[]): never {
  void inputs;
  throw new NotImplementedError();
}
