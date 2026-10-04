import type { RunResult } from '@pkgs/sql-client-root-shared/interface';

export type WireSafetyViolation = {
  readonly path: string;
  readonly reason: string;
};

/**
 * Wire oracle: rows must never contain bigint (the web engine throws
 * `Cannot convert BigInt to number` on Number(bigint) / JSON.stringify).
 */
export function findWireSafetyViolations(
  value: unknown,
  path = '$'
): WireSafetyViolation[] {
  if (typeof value === 'bigint') {
    return [{ path, reason: 'bigint' }];
  }
  if (value === null || value === undefined) return [];
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return [{ path, reason: `non-finite number ${String(value)}` }];
    }
    // Math.max must accept every number cell.
    void Math.max(0, value);
    return [];
  }
  if (typeof value === 'string' || typeof value === 'boolean') return [];
  if (value instanceof Date || value instanceof Uint8Array) return [];
  if (Array.isArray(value)) {
    const out: WireSafetyViolation[] = [];
    for (let i = 0; i < value.length; i += 1) {
      out.push(...findWireSafetyViolations(value[i], `${path}[${i}]`));
    }
    return out;
  }
  if (typeof value === 'object') {
    const out: WireSafetyViolation[] = [];
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>
    )) {
      out.push(...findWireSafetyViolations(nested, `${path}.${key}`));
    }
    return out;
  }
  return [{ path, reason: `unsupported type ${typeof value}` }];
}

export function assertWireSafeRows(
  rows: readonly Record<string, unknown>[],
  label: string
): void {
  const violations = findWireSafetyViolations(rows);
  if (violations.length > 0) {
    const first = violations[0]!;
    throw new Error(
      `${label}: wire-safety ${first.reason} at ${first.path} (${violations.length} total)`
    );
  }
  try {
    JSON.stringify(rows);
  } catch (err: unknown) {
    throw new Error(
      `${label}: JSON.stringify failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function assertWireSafeRunResult(
  result: RunResult,
  label: string
): void {
  if (typeof result.changes !== 'number' || !Number.isFinite(result.changes)) {
    throw new Error(
      `${label}: RunResult.changes must be finite number, got ${typeof result.changes}`
    );
  }
  if (
    typeof result.lastInsertRowid !== 'number' ||
    !Number.isFinite(result.lastInsertRowid)
  ) {
    throw new Error(
      `${label}: RunResult.lastInsertRowid must be finite number, got ${typeof result.lastInsertRowid}`
    );
  }
  if (typeof (result as { changes?: unknown }).changes === 'bigint') {
    throw new Error(`${label}: RunResult.changes is bigint`);
  }
}
