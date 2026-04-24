export interface Env {
  DATABASE_URL: string;
  /** Optional: Google Web client ID for verifying id_token `aud`. */
  GOOGLE_CLIENT_ID?: string;
}

/** Env after validation: every field is proved present and well-typed. */
export interface ValidatedEnv {
  readonly databaseUrl: string;
  readonly googleClientId: string | null;
}

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
 * Validates Worker env bindings at the trust boundary. On any violation,
 * throws {@link ConfigurationError}; the caller must treat this as fatal.
 *
 * Empty-string values for optional vars are coerced to `null` (Cloudflare
 * surfaces unset vars as empty strings in some paths).
 */
export function validateEnv(env: Env): ValidatedEnv {
  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new ConfigurationError(
      'DATABASE_URL env var is required and must be a non-empty string'
    );
  }

  const rawGoogle = env.GOOGLE_CLIENT_ID;
  if (rawGoogle !== undefined && typeof rawGoogle !== 'string') {
    throw new ConfigurationError(
      'GOOGLE_CLIENT_ID env var, if present, must be a string'
    );
  }
  const googleClientId =
    typeof rawGoogle === 'string' && rawGoogle.length > 0 ? rawGoogle : null;

  return {
    databaseUrl,
    googleClientId,
  };
}
