import type { SecretEntry } from './types';

const VERCEL_USER_URL = 'https://api.vercel.com/v2/user';
const VERCEL_TEAM_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

/**
 * Vercel Access Token used by Turborepo's Vercel Remote Cache backend.
 *
 * Generate at https://vercel.com/account/tokens with scope to the team
 * named in `TURBO_TEAM`. Validation calls Vercel's `/v2/user` endpoint
 * (the Bearer-auth health check the Vercel CLI uses internally) so we
 * fail fast on a wrong / expired token rather than waiting for the
 * first cache write to 401.
 */
export class TurboToken implements SecretEntry {
  readonly secretKey = 'TURBO_TOKEN';
  readonly env = 'TURBO_TOKEN';
  readonly hint =
    'Vercel Access Token from https://vercel.com/account/tokens (scoped to the team in TURBO_TEAM)';

  async validate(token: string): Promise<string | null> {
    try {
      const res = await fetch(VERCEL_USER_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        return `Vercel rejected TURBO_TOKEN — HTTP ${res.status} from ${VERCEL_USER_URL} (token revoked or wrong scope?)`;
      }
      if (!res.ok) {
        // Transient errors (5xx, rate limits) shouldn't block CI on a
        // value Vercel has actually accepted before; soft-pass and let
        // a real cache call surface the failure.
        return null;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Vercel team slug — the URL slug for the team that owns the Remote
 * Cache. Find it in the team URL or `Settings → General`.
 *
 * Validation only enforces basic slug shape; correctness against the
 * actual team is implicitly checked when {@link TurboToken} authenticates
 * against `/v2/user` (and ultimately when Turbo issues a cache request).
 */
export class TurboTeam implements SecretEntry {
  readonly secretKey = 'TURBO_TEAM';
  readonly env = 'TURBO_TEAM';
  readonly hint =
    'Vercel team slug (e.g. `acme-co`) — visible in the Vercel dashboard URL';

  async validate(value: string): Promise<string | null> {
    if (!VERCEL_TEAM_SLUG_RE.test(value)) {
      return `Invalid TURBO_TEAM "${value}" — expected a Vercel team slug (lowercase letters, digits, dashes)`;
    }
    return null;
  }
}

/** Optional — derived default `auto` is populated by `DopplerResource`
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
 * `remote:rw` is populated by `DopplerResource` when absent. */
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
