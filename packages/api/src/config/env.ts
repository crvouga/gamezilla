/**
 * Cloudflare Worker bindings.
 *
 * - `DOPPLER_TOKEN` (required): a Doppler token used to download secrets at boot.
 *   In production this is a config-scoped service token (`dp.st.…`), which does
 *   not require `project`/`config` query params.
 * - `DOPPLER_PROJECT` / `DOPPLER_CONFIG` (optional): only needed when the token
 *   is *not* a config-scoped service token (e.g. CLI tokens `dp.ct.…` written
 *   into `.dev.vars` by `setup-dev-vars`). The Doppler secrets-download API
 *   returns HTTP 400 for non-service tokens unless these are supplied.
 */
/**
 * Structural shape of the Durable Object namespace consumed by the room
 * route. Defined locally so this module compiles for downstream consumers
 * (e.g. `packages/infra` pulling in `@gamezilla/api/rpc`) that do not load the
 * api package's ambient Cloudflare type stubs in `app/cloudflare.d.ts`.
 */
export type SpaceNamespace = {
  idFromName(name: string): object;
  get(id: object): { fetch(request: Request): Promise<Response> };
};

/** Cloudflare Hyperdrive binding (`[[hyperdrive]]` in wrangler). */
export type HyperdriveBinding = {
  readonly connectionString: string;
};

export type ApiWorkerEnv = {
  DOPPLER_TOKEN: string;
  DOPPLER_PROJECT?: string;
  DOPPLER_CONFIG?: string;
  /** Cloudflare Hyperdrive — Worker uses {@link HyperdriveBinding.connectionString} for Postgres. */
  HYPERDRIVE: HyperdriveBinding;
  /** Space Durable Object namespace (one DO per space topic). Omitted in unit tests. */
  SPACE?: SpaceNamespace;
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
 * Validates `DOPPLER_TOKEN` at boot. Throws {@link ConfigurationError}
 * when missing, wrong type, or whitespace-only.
 */
export function assertDopplerTokenBinding(env: ApiWorkerEnv): string {
  const raw = env.DOPPLER_TOKEN;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new ConfigurationError(
      'DOPPLER_TOKEN is required (non-empty string). Set this Worker secret or add it to .dev.vars; remaining API config is loaded from Doppler.'
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
 * Reads optional `DOPPLER_PROJECT` and `DOPPLER_CONFIG` bindings. Required by
 * the Doppler secrets-download API for non-service tokens (CLI / personal /
 * service-account). Production with a config-scoped service token returns both
 * `null` and the API works without them.
 */
export function readDopplerScopeBindings(env: ApiWorkerEnv): {
  project: string | null;
  config: string | null;
} {
  return {
    project: readOptionalBinding(env.DOPPLER_PROJECT),
    config: readOptionalBinding(env.DOPPLER_CONFIG),
  };
}
