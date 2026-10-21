/** Postgres `serialization_failure` and `deadlock_detected`. */
const TRANSIENT_CONFLICT_CODES: ReadonlySet<string> = new Set([
  '40001',
  '40P01',
]);
const MAX_CAUSE_DEPTH = 4;

/**
 * A database conflict that the same work will usually survive when run again:
 * two transactions raced and the database chose to abort one. It says nothing
 * about the work itself, so it must never count as the work failing for good.
 */
export function isTransientConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (current === null || typeof current !== 'object') return false;
    const code = (current as { readonly code?: unknown }).code;
    if (typeof code === 'string' && TRANSIENT_CONFLICT_CODES.has(code))
      return true;
    current = (current as { readonly cause?: unknown }).cause;
  }
  return false;
}
