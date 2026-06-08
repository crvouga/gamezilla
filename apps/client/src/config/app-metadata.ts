import { assert } from '@pkgs/assert';
import { COMMIT_HASH_HEX_REGEX } from '@pkgs/git';

export { COMMIT_HASH_HEX_REGEX };

/**
 * Commit hash baked into the bundle at build time. No implicit default —
 * misconfiguration fails loudly (Tiger Style).
 */
export function getCommitHash(): string {
  // eslint-disable-next-line expo/no-dynamic-env-var -- `noPropertyAccessFromIndexSignature` requires bracket `process.env` access; Expo still inlines `EXPO_PUBLIC_*`.
  const raw = process.env['EXPO_PUBLIC_COMMIT_HASH'];
  assert.string(
    raw,
    'EXPO_PUBLIC_COMMIT_HASH is required; run `bun run dev` (with Vault) or set apps/client/.env.local'
  );
  const normalized = raw.trim().toLowerCase();
  assert.nonEmptyString(
    normalized,
    'EXPO_PUBLIC_COMMIT_HASH is required; run `bun run dev` (with Vault) or set apps/client/.env.local'
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
