import type { SecretEntry } from './types';

const TEAM_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

/**
 * Vercel scoped access token for Remote Cache (Settings → Tokens).
 * Reachability + auth are verified end-to-end by
 * `scripts/check-turbo-remote-cache.ts`.
 */
export class TurboToken implements SecretEntry {
  readonly secretKey = 'TURBO_TOKEN';
  readonly env = 'TURBO_TOKEN';
  readonly hint = 'Vercel scoped access token (Settings → Tokens)';

  async validate(token: string): Promise<string | null> {
    if (token.trim().length === 0) {
      return 'TURBO_TOKEN must not be empty';
    }
    if (/^<[^>]+>$/.test(token.trim())) {
      return 'TURBO_TOKEN looks like a placeholder — use a real Vercel access token';
    }
    if (token.trim().length < 20) {
      return 'TURBO_TOKEN is too short — expected a Vercel access token';
    }
    return null;
  }
}

/** Vercel team slug (from `https://vercel.com/<team-slug>/…`). */
export class TurboTeam implements SecretEntry {
  readonly secretKey = 'TURBO_TEAM';
  readonly env = 'TURBO_TEAM';
  readonly hint = 'Vercel team slug (from team URL)';

  async validate(value: string): Promise<string | null> {
    if (!TEAM_SLUG_RE.test(value)) {
      return `Invalid TURBO_TEAM "${value}" — expected a slug (lowercase letters, digits, dashes)`;
    }
    return null;
  }
}

/** Optional — derived default `auto` is populated by `VaultResource`
 * when absent. Listed here so the value (when set) is validated and the
 * orphan check recognizes it as managed. */
export class TurboLogOrder implements SecretEntry {
  readonly secretKey = 'TURBO_LOG_ORDER';
  readonly env = 'TURBO_LOG_ORDER';
  readonly hint = 'stream';
  readonly optional = true;

  async validate(): Promise<string | null> {
    return null;
  }
}

/** Forces turbo to use the remote cache for every invocation. Same
 * syntax as the `--cache` CLI flag. Optional — derived default
 * `remote:rw` is populated by `VaultResource` when absent. */
export class TurboCache implements SecretEntry {
  readonly secretKey = 'TURBO_CACHE';
  readonly env = 'TURBO_CACHE';
  readonly hint = 'remote:rw';
  readonly optional = true;

  async validate(value: string): Promise<string | null> {
    if (!/^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/.test(value)) {
      return `Invalid TURBO_CACHE value: ${value} (expected e.g. "remote:rw")`;
    }
    return null;
  }
}
