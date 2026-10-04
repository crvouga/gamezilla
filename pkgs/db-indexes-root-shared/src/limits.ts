/** Hard bounds — exceed at ingest = throw, never silent truncate. */

export const LIMITS = Object.freeze({
  maxStatements: 4096,
  maxTablesPerStatement: 16,
  maxCandidatesPerStatement: 32,
  maxPlanActions: 256,
  maxIndexNameLength: 63,
  maxTableNameLength: 40,
  maxColumnsPerIndex: 16,
  maxIncludeColumns: 8,
  maxPredicateLength: 1024,
  maxSqlFingerprintLength: 16_384,
  maxOwnedMetaPayload: 4096,
  maxHarnessTables: 256,
  maxHarnessIndexes: 1024,
  maxFaultSchedule: 512,
  hash8HexLength: 8,
} as const);

export type Limits = typeof LIMITS;

export class LimitExceededError extends Error {
  readonly value: number;
  readonly limit: number;
  readonly label: string;

  constructor(label: string, value: number, limit: number) {
    super(`${label}: exceeds limit ${String(limit)} (got ${String(value)})`);
    this.name = 'LimitExceededError';
    this.label = label;
    this.value = value;
    this.limit = limit;
  }
}

/**
 * Boundary check — throws {@link LimitExceededError} (catchable), not assert crash.
 */
export function assertWithinLimit(
  value: number,
  limit: number,
  label: string
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new LimitExceededError(label, value, limit);
  }
  if (value > limit) {
    throw new LimitExceededError(label, value, limit);
  }
}
