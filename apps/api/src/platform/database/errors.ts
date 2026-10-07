interface PgError {
  code: string;
  constraint?: string;
}

/** The Postgres error with `code` (e.g. `23505`); drizzle may wrap the driver error in `cause`. */
export function findPgError(error: unknown, code: string): PgError | null {
  for (let e = error; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === code) return e as PgError;
  }
  return null;
}

/** Postgres unique_violation. */
export function isUniqueViolation(error: unknown): boolean {
  return findPgError(error, '23505') !== null;
}

/** Postgres exclusion_violation (an EXCLUDE constraint such as overlapping ranges). */
export function isExclusionViolation(error: unknown): boolean {
  return findPgError(error, '23P01') !== null;
}
