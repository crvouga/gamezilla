/**
 * Cloudflare Worker bindings for the API Worker.
 *
 * Secrets are injected as env vars at deploy time (`wrangler secret bulk`) or
 * via generated `.dev.vars` for local dev. The runtime never fetches secrets
 * from a remote store.
 */
export type RoomNamespace = {
  idFromName(name: string): object;
  get(id: object): { fetch: (request: Request) => Promise<Response> };
};

export type ApiWorkerEnv = {
  /** `dev` or `prd` — used by DB-safety guards. */
  SECRETS_ENV?: string;
  /**
   * Loopback wrangler origin written into `.dev.vars` when turbo
   * preview sets `API_URL` in the environment.
   */
  API_URL?: string;
  DATABASE_URL?: string;
  AUTH_SECRET?: string;
  WEB_CLIENT_GOOGLE_CLIENT_ID?: string;
  WEB_CLIENT_GOOGLE_CLIENT_SECRET?: string;
  /**
   * Origin of the OpenID provider to treat as Google. Unset means real
   * Google; the localhost stack points it at its own simulated provider.
   */
  GOOGLE_IDP_ORIGIN?: string;
  /**
   * Sign in with Apple, **non-production only**: the origin of the simulated
   * Apple provider plus the Services ID registration it knows this app by
   * (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and the ES256
   * `APPLE_PRIVATE_JWK` the client secret is signed with). All five, or none.
   */
  APPLE_IDP_ORIGIN?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_JWK?: string;
  /**
   * Which configured membership provider new checkouts go to, by provider
   * id. Required when more than one is configured; members of the others keep
   * being served there. Each provider reads its own secrets and bindings.
   */
  BILLING_PROVIDER?: string;
  ELEVEN_LABS_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  OBSERVABILITY_BACKEND?: string;
  OBSERVABILITY_COLLECTOR_URL?: string;
  ROOM?: RoomNamespace;
  [key: string]: string | RoomNamespace | undefined;
};

export class ConfigurationError extends Error {
  readonly __configuration_error = true as const;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function readOptionalBinding(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function readSecretsEnvBinding(env: ApiWorkerEnv): string | null {
  return readOptionalBinding(env.SECRETS_ENV);
}

export function assertSecretsEnvBinding(env: ApiWorkerEnv): string {
  const secretsEnv = readSecretsEnvBinding(env);
  if (secretsEnv === null) {
    throw new ConfigurationError(
      'SECRETS_ENV is required (non-empty string). Set via wrangler secret or .dev.vars.'
    );
  }
  return secretsEnv;
}

export function readOptionalApiUrlOverride(env: ApiWorkerEnv): string | null {
  return readOptionalBinding(env.API_URL);
}

export function readOptionalGoogleIdpOrigin(env: ApiWorkerEnv): string | null {
  return readOptionalBinding(env.GOOGLE_IDP_ORIGIN);
}

export type AppleMockBindings = {
  readonly origin: string;
  readonly clientId: string;
  readonly teamId: string;
  readonly keyId: string;
  readonly privateJwk: Record<string, unknown>;
};

/**
 * The simulated Apple provider, when configured. Apple sign-in exists only to
 * run against the mock: in `prd` it is refused outright, and a partial set of
 * bindings is a misconfiguration, not a degraded mode.
 */
export function readAppleMockBindings(
  env: ApiWorkerEnv
): AppleMockBindings | null {
  const values = [
    env.APPLE_IDP_ORIGIN,
    env.APPLE_CLIENT_ID,
    env.APPLE_TEAM_ID,
    env.APPLE_KEY_ID,
    env.APPLE_PRIVATE_JWK,
  ].map(readOptionalBinding);
  if (values.every((value) => value === null)) return null;
  if (readSecretsEnvBinding(env) === 'prd') {
    throw new ConfigurationError(
      'Sign in with Apple is mock-only: APPLE_* bindings are refused in prd'
    );
  }
  const [origin, clientId, teamId, keyId, jwk] = values;
  if (
    origin == null ||
    clientId == null ||
    teamId == null ||
    keyId == null ||
    jwk == null
  ) {
    throw new ConfigurationError(
      'APPLE_IDP_ORIGIN, APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_JWK go together'
    );
  }
  return {
    origin,
    clientId,
    teamId,
    keyId,
    privateJwk: JSON.parse(jwk) as Record<string, unknown>,
  };
}

export function readBillingProviderBinding(env: ApiWorkerEnv): string | null {
  return readOptionalBinding(env.BILLING_PROVIDER)?.toLowerCase() ?? null;
}

/**
 * The provider new checkouts go to, among the configured ones: the one
 * `BILLING_PROVIDER` names, else the only one configured. `null` when none
 * is configured. Naming an unconfigured provider, or leaving the choice open
 * between several, is a misconfiguration — never a silent pick.
 */
export function resolveCheckoutProvider(
  binding: string | null,
  configured: readonly string[]
): string | null {
  if (binding !== null) {
    if (!configured.includes(binding)) {
      throw new ConfigurationError(
        `BILLING_PROVIDER=${binding}, but ${binding} is not configured (configured: ${configured.join(', ') || 'none'})`
      );
    }
    return binding;
  }
  if (configured.length > 1) {
    throw new ConfigurationError(
      `several billing providers are configured (${configured.join(', ')}); set BILLING_PROVIDER to the one new checkouts go to`
    );
  }
  return configured[0] ?? null;
}

export function readOptionalDatabaseUrlOverride(
  env: ApiWorkerEnv
): string | null {
  return readOptionalBinding(env.DATABASE_URL);
}

export function workerEnvToSecretRecord(
  env: ApiWorkerEnv
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}
