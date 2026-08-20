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
   * Loopback wrangler origin written into `.dev.vars` when Playwright / turbo
   * preview sets `API_URL` in the environment.
   */
  API_URL?: string;
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  WEB_CLIENT_GOOGLE_CLIENT_ID?: string;
  WEB_CLIENT_GOOGLE_CLIENT_SECRET?: string;
  ELEVEN_LABS_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  B2_APP_KEY_ID?: string;
  B2_APP_KEY?: string;
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
