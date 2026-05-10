import { assert } from '@gamezilla/lib/assert';

/**
 * Git object id as lowercase hex: short (≥7) or full SHA-1 (40).
 * Invariant: baked in at client build time via `EXPO_PUBLIC_COMMIT_HASH`.
 */
export const COMMIT_HASH_HEX_REGEX = /^[0-9a-f]{7,40}$/;

/**
 * Commit hash baked into the bundle at build time. No implicit default —
 * misconfiguration fails loudly (Tiger Style).
 */
export function getCommitHash(): string {
  // `noPropertyAccessFromIndexSignature` requires bracket notation for
  // process.env; Expo's bundler still inlines `EXPO_PUBLIC_*` literals.
  // eslint-disable-next-line expo/no-dynamic-env-var
  const raw = process.env['EXPO_PUBLIC_COMMIT_HASH'];
  assert.string(
    raw,
    'EXPO_PUBLIC_COMMIT_HASH is required; run `bun run dev` (with Doppler) or set apps/client/.env.local'
  );
  const normalized = raw.trim().toLowerCase();
  assert.nonEmptyString(
    normalized,
    'EXPO_PUBLIC_COMMIT_HASH is required; run `bun run dev` (with Doppler) or set apps/client/.env.local'
  );
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(normalized),
    'EXPO_PUBLIC_COMMIT_HASH must be a lowercase hex commit SHA',
    { raw }
  );
  return normalized;
}

export function getShortCommitHash(): string {
  return getCommitHash().slice(0, 7);
}
