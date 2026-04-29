/**
 * Cloudflare Worker bindings: `DOPPLER_TOKEN` is a config-scoped Doppler service
 * token; all other config is fetched from Doppler at boot via SecretStore.
 */
export type ApiWorkerEnv = {
  DOPPLER_TOKEN: string;
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
