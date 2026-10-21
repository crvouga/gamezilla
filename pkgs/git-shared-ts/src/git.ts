import { assert } from '@pkgs/assert-root-shared-ts/singleton';

/**
 * Git object id as lowercase hex: short (≥7) or full SHA-1 (40).
 * Invariant: baked in at client build time via `VITE_COMMIT_HASH`.
 */
export const COMMIT_HASH_HEX_REGEX = /^[0-9a-f]{7,40}$/;

/**
 * Strict ISO 8601 committer timestamp from `git log --format=%cI`.
 * Invariant: baked in at client build time via `VITE_COMMIT_DATE`.
 */
export const COMMIT_DATE_ISO_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function assertCommitDateIso(value: string): void {
  const normalized = value.trim();
  assert.nonEmptyString(
    normalized,
    'commit date must be a non-empty ISO 8601 string'
  );
  assert.ok(
    COMMIT_DATE_ISO_REGEX.test(normalized),
    'commit date must be strict ISO 8601 (git log --format=%cI)',
    { value }
  );
  const parsed = Date.parse(normalized);
  assert.ok(
    !Number.isNaN(parsed),
    'commit date must parse as a valid timestamp',
    { value, parsed }
  );
}
