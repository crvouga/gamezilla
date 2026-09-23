import { APP_IDENTITY } from '@libs/auth/public/app-identity';
import { assert } from '@pkgs/assert';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';

export { COMMIT_HASH_HEX_REGEX };

/** Human-facing product name shown on the About screen. */
export const APP_NAME: string = APP_IDENTITY.displayName;

/** Marketing version (mirrors `apps/client/package.json` `version`). */
export const APP_VERSION = '1.0.0';

type CommitEnv = {
  readonly VITE_COMMIT_HASH?: string;
  readonly VITE_COMMIT_DATE?: string;
};

function commitEnv(): CommitEnv {
  const env: CommitEnv = import.meta.env;
  return env;
}

/**
 * Build provenance is present when the bundle was produced through
 * `setup-env` / `deploy` (which inline `VITE_COMMIT_*`). Bare test hosts have
 * neither; callers show an explicit "unavailable" state instead of guessing.
 */
export function hasCommitProvenance(): boolean {
  const env = commitEnv();
  return (
    typeof env.VITE_COMMIT_HASH === 'string' &&
    typeof env.VITE_COMMIT_DATE === 'string'
  );
}

/**
 * Commit hash baked into the bundle at build time. No implicit default —
 * misconfiguration fails loudly (Tiger Style).
 */
export function getCommitHash(): string {
  const raw = commitEnv().VITE_COMMIT_HASH;
  assert.string(
    raw,
    'VITE_COMMIT_HASH is required; run `bun start:localhost` from the repository root or set apps/client/.env.local'
  );
  const normalized = raw.trim().toLowerCase();
  assert.nonEmptyString(
    normalized,
    'VITE_COMMIT_HASH is required; run `bun start:localhost` from the repository root or set apps/client/.env.local'
  );
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(normalized),
    'VITE_COMMIT_HASH must be a lowercase hex commit SHA',
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
  const raw = commitEnv().VITE_COMMIT_DATE;
  assert.string(
    raw,
    'VITE_COMMIT_DATE is required; run `bun start:localhost` from the repository root or set apps/client/.env.local'
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
