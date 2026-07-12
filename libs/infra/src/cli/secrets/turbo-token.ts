import type { SecretEntry } from './types';

const TEAM_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

/**
 * Origin of the self-hosted Turborepo Remote Cache. Turbo reads it from the
 * `TURBO_API` env var. Must be an `https` URL (e.g.
 * `https://turborepo.chrisvouga.dev`). The bearer token in
 * {@link TurboToken} authenticates against this origin.
 */
export class TurboApi implements SecretEntry {
  readonly secretKey = 'TURBO_API';
  readonly env = 'TURBO_API';
  readonly hint =
    'Self-hosted cache origin (e.g. https://turborepo.chrisvouga.dev) — the TURBO_API env for the turbo CLI';

  async validate(value: string): Promise<string | null> {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') {
        return `TURBO_API must be an https URL, got "${value}"`;
      }
      if (url.hostname === 'vercel.com' || url.hostname.endsWith('.vercel.com')) {
        return `TURBO_API must not point at Vercel (got "${value}") — use the self-hosted cache`;
      }
    } catch {
      return `Invalid TURBO_API "${value}" — expected an https URL (e.g. https://turborepo.chrisvouga.dev)`;
    }
    return null;
  }
}

/**
 * Bearer token Turbo clients send to the self-hosted cache (matches the
 * cache server's own `TURBO_TOKEN`). Reachability + auth are verified
 * end-to-end by `scripts/check-turbo-remote-cache.ts` (which hits
 * `${TURBO_API}/v8/artifacts/status`), so validation here only enforces
 * presence — a network probe would make secret validation flaky.
 */
export class TurboToken implements SecretEntry {
  readonly secretKey = 'TURBO_TOKEN';
  readonly env = 'TURBO_TOKEN';
  readonly hint =
    'Bearer token the self-hosted turborepo-remote-cache validates (matches its TURBO_TOKEN)';

  async validate(token: string): Promise<string | null> {
    if (token.trim().length === 0) {
      return 'TURBO_TOKEN must not be empty';
    }
    return null;
  }
}

/**
 * Turbo team slug. The self-hosted cache accepts any slug; Turbo just
 * requires the value to be present and well-formed for remote cache requests.
 */
export class TurboTeam implements SecretEntry {
  readonly secretKey = 'TURBO_TEAM';
  readonly env = 'TURBO_TEAM';
  readonly hint =
    'Any team slug (we use `crvouga`) — required by the turbo CLI for remote cache';

  async validate(value: string): Promise<string | null> {
    if (!TEAM_SLUG_RE.test(value)) {
      return `Invalid TURBO_TEAM "${value}" — expected a slug (lowercase letters, digits, dashes)`;
    }
    return null;
  }
}

/** Optional — derived default `auto` is populated by `SecretsResource`
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
 * `remote:rw` is populated by `SecretsResource` when absent. */
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
