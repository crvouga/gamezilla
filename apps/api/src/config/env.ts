/**
 * Cloudflare Worker bindings for the API Worker.
 *
 * - `VAULT_TOKEN` (required): Vault token used to read secrets at boot.
 * - `VAULT_PROJECT` (optional): project slug; defaults to `personal`.
 * - `VAULT_CONFIG` (required for non-root tokens): config name (`dev` / `prd`).
 * - `VAULT_ADDR` (optional): Vault API address; defaults to the store URL.
 */
import { readDevIdpPortFromBinding } from '@pkgs/dev-idp/config';

/**
 * Structural shape of the Durable Object namespace consumed by the room
 * route. Defined locally so this module compiles for downstream consumers
 * that do not load the api package's ambient Cloudflare type stubs.
 */
export type RoomNamespace = {
  idFromName(name: string): object;
  get(id: object): { fetch(request: Request): Promise<Response> };
};

export type ApiWorkerEnv = {
  VAULT_TOKEN: string;
  VAULT_PROJECT?: string;
  VAULT_CONFIG?: string;
  VAULT_ADDR?: string;
  /**
   * Loopback wrangler origin (e.g. `http://localhost:8788`) written into
   * `.dev.vars` by `setup-dev-vars` when Playwright / turbo preview sets
   * `API_URL` in the environment. Overrides Vault `API_URL` for local Better Auth.
   */
  API_URL?: string;
  /**
   * Optional Postgres wire URL written into `.dev.vars` by `setup-dev-vars`.
   * Mirrors Vault `dev` `DATABASE_URL` so the Worker and `migrate-db` use the
   * same hosted dev database during local preview / QA.
   */
  DATABASE_URL?: string;
  /** Mirrored from Vault `dev` by `setup-dev-vars` for local Better Auth. */
  BETTER_AUTH_SECRET?: string;
  /** Mirrored from Vault `dev` by `setup-dev-vars` for local Google OAuth. */
  WEB_CLIENT_GOOGLE_CLIENT_ID?: string;
  /** Mirrored from Vault `dev` by `setup-dev-vars` for local Google OAuth. */
  WEB_CLIENT_GOOGLE_CLIENT_SECRET?: string;
  /**
   * Optional dev IdP TCP port (e.g. `5557` for Playwright QA). Written into
   * `.dev.vars` by `setup-dev-vars` when turbo preview sets `DEV_IDP_PORT`.
   */
  DEV_IDP_PORT?: string;
  /** Local observability backend override (`local-file` or `sentry`). */
  OBSERVABILITY_BACKEND?: string;
  /** Optional span collector origin for local-file backend. */
  OBSERVABILITY_COLLECTOR_URL?: string;
  /** Sentry DSN for error reporting and performance monitoring. */
  SENTRY_DSN?: string;
  /** Room Durable Object namespace (one DO per topic). Omitted in unit tests. */
  ROOM?: RoomNamespace;
};

/**
 * Non-recoverable misconfiguration at the env trust boundary. Signals to the
 * top-level Worker handler that the isolate must latch a fatal state and
 * refuse to serve traffic (Tiger Style: fail loudly, never silently; do not
 * retry the unrecoverable).
 */
export class ConfigurationError extends Error {
  readonly __configuration_error = true as const;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validates `VAULT_TOKEN` at boot. Throws {@link ConfigurationError}
 * when missing, wrong type, or whitespace-only.
 */
export function assertVaultTokenBinding(env: ApiWorkerEnv): string {
  const raw = env.VAULT_TOKEN;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new ConfigurationError(
      'VAULT_TOKEN is required (non-empty string). Set this Worker secret or add it to .dev.vars; remaining API config is loaded from Vault.'
    );
  }
  return raw.trim();
}

function readOptionalBinding(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * Reads `VAULT_PROJECT` and `VAULT_CONFIG` bindings for KV path scoping.
 */
export function readVaultScopeBindings(env: ApiWorkerEnv): {
  project: string | null;
  config: string | null;
  addr: string | null;
} {
  return {
    project: readOptionalBinding(env.VAULT_PROJECT),
    config: readOptionalBinding(env.VAULT_CONFIG),
    addr: readOptionalBinding(env.VAULT_ADDR),
  };
}

/** Non-empty `API_URL` Worker binding from `.dev.vars` (preview / QA only). */
export function readOptionalApiUrlOverride(env: ApiWorkerEnv): string | null {
  return readOptionalBinding(env.API_URL);
}

/** Non-empty `DATABASE_URL` Worker binding from `.dev.vars` (preview / QA only). */
export function readOptionalDatabaseUrlOverride(
  env: ApiWorkerEnv
): string | null {
  return readOptionalBinding(env.DATABASE_URL);
}

/** Dev IdP port from `.dev.vars` / preview env; defaults via {@link readDevIdpPortFromBinding}. */
export function readDevIdpPortBinding(env: ApiWorkerEnv): number {
  return readDevIdpPortFromBinding(env.DEV_IDP_PORT);
}
