import { assert } from '@pkgs/assert';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';

export { COMMIT_HASH_HEX_REGEX };

/**
 * Commit hash baked into the bundle at build time. No implicit default —
 * misconfiguration fails loudly (Tiger Style).
 */
export function getCommitHash(): string {
  // Expo inlines EXPO_PUBLIC_*; bracket access required by noPropertyAccessFromIndexSignature. `noPropertyAccessFromIndexSignature` requires bracket `process.env` access; Expo still inlines `EXPO_PUBLIC_*`.
  const raw = process.env['EXPO_PUBLIC_COMMIT_HASH'];
  assert.string(
    raw,
    'EXPO_PUBLIC_COMMIT_HASH is required; run `bun run dev` (with secret store) or set apps/client/.env.local'
  );
  const normalized = raw.trim().toLowerCase();
  assert.nonEmptyString(
    normalized,
    'EXPO_PUBLIC_COMMIT_HASH is required; run `bun run dev` (with secret store) or set apps/client/.env.local'
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

/**
 * Committer date baked into the bundle at build time (git `log --format=%cI`).
 */
export function getCommitDate(): string {
  // Expo inlines EXPO_PUBLIC_*; bracket access required by noPropertyAccessFromIndexSignature. `noPropertyAccessFromIndexSignature` requires bracket `process.env` access; Expo still inlines `EXPO_PUBLIC_*`.
  const raw = process.env['EXPO_PUBLIC_COMMIT_DATE'];
  assert.string(
    raw,
    'EXPO_PUBLIC_COMMIT_DATE is required; run `bun run dev` (with secret store) or set apps/client/.env.local'
  );
  const normalized = raw.trim();
  assertCommitDateIso(normalized);
  return normalized;
}

export function formatCommitDate(iso: string, locale: string): string {
  assertCommitDateIso(iso);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}
