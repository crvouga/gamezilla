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

/** The part of Cloudflare's `Hyperdrive` binding the Worker reads. */
export type HyperdriveBinding = {
  readonly connectionString: string;
};

export type WorkerAssets = {
  readonly fetch: (request: Request) => Promise<Response>;
};

export type ApiWorkerEnv = {
  /** The secrets environment's name (`dev`, `prd`, …) — a label only. */
  SECRETS_ENV?: string;
  /**
   * Loopback wrangler origin written into `.dev.vars` when turbo
   * preview sets `API_URL` in the environment.
   */
  API_URL?: string;
  DATABASE_URL?: string;
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
  REPORTS_BUCKET?: string;
  REPORTS_ENDPOINT?: string;
  REPORTS_ACCESS_KEY_ID?: string;
  REPORTS_SECRET_ACCESS_KEY?: string;
  OBSERVABILITY_COLLECTOR_URL?: string;
  OBSERVABILITY_COLLECTOR_TOKEN?: string;
  OBSERVABILITY_COLLECTOR_USER?: string;
  /** Explicit emergency kill switch. Production otherwise fails closed. */
  OBSERVABILITY_ENABLED?: string;
  /** Stamped by libs/infra render-wrangler on deployed Workers only. */
  DEPLOYMENT_ENVIRONMENT?: string;
  /**
   * The env file's `protection` (`production` / `standard`), stamped by
   * libs/infra render-wrangler on deployed Workers; absent locally.
   */
  DEPLOYMENT_PROTECTION?: string;
  /** JSON array rendered from this environment's infrastructure file. */
  PUZZLE_MANAGER_ACCOUNT_IDS?: string;
  POPULATION_OPERATOR_ACCOUNT_IDS?: string;
  BUILD_SHA?: string;
  FEEDBACK_GITHUB_TOKEN?: string;
  FEEDBACK_GITHUB_REPOSITORY?: string;
  ROOM?: RoomNamespace;
  /**
   * Hyperdrive in front of the environment's Postgres (rendered by
   * `@libs/infra/public/wrangler` from OpenTofu's config id). Absent in
   * `wrangler dev` and the localhost stack, which connect directly.
   */
  HYPERDRIVE?: HyperdriveBinding;
  ASSETS?: WorkerAssets;
  [key: string]:
    | string
    | RoomNamespace
    | HyperdriveBinding
    | WorkerAssets
    | undefined;
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

/** Binding the deployed Worker learns its environment's protection from. */
export const DEPLOYMENT_PROTECTION_BINDING = 'DEPLOYMENT_PROTECTION';

/**
 * Whether this deployment is production — the one question every
 * production-only runtime branch asks. Deployed Workers carry their env
 * file's `protection`; local runs (wrangler dev, the localhost stack, harnesses)
 * carry none and are `standard`.
 */
export type DeploymentProtection = 'production' | 'standard';

export function readDeploymentProtection(
  env: Pick<ApiWorkerEnv, 'DEPLOYMENT_PROTECTION'>
): DeploymentProtection {
  const raw = readOptionalBinding(env.DEPLOYMENT_PROTECTION);
  if (raw === null || raw === 'standard') return 'standard';
  if (raw === 'production') return 'production';
  throw new ConfigurationError(
    `${DEPLOYMENT_PROTECTION_BINDING} must be "production" or "standard", got ${JSON.stringify(raw)}`
  );
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

export function readPuzzleManagerAccountIds(
  env: Pick<ApiWorkerEnv, 'PUZZLE_MANAGER_ACCOUNT_IDS'>
): readonly string[] {
  return readAccountIds(
    env.PUZZLE_MANAGER_ACCOUNT_IDS,
    'PUZZLE_MANAGER_ACCOUNT_IDS'
  );
}

export function readPopulationOperatorAccountIds(
  env: Pick<ApiWorkerEnv, 'POPULATION_OPERATOR_ACCOUNT_IDS'>
): readonly string[] {
  return readAccountIds(
    env.POPULATION_OPERATOR_ACCOUNT_IDS,
    'POPULATION_OPERATOR_ACCOUNT_IDS'
  );
}

function readAccountIds(
  value: string | undefined,
  name: string
): readonly string[] {
  const raw = readOptionalBinding(value);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigurationError(
      `${name} must be a JSON array of non-empty strings`
    );
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (value) => typeof value !== 'string' || value.trim().length === 0
    )
  ) {
    throw new ConfigurationError(
      `${name} must be a JSON array of non-empty strings`
    );
  }
  const accountIds = parsed as string[];
  return [...new Set(accountIds.map((value) => value.trim()))].sort();
}

/** Rendered per env by `@libs/infra` from the env file's `billing.provider`. */
export const BILLING_PROVIDER_BINDING = 'BILLING_PROVIDER';

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

/**
 * What the Worker opens Postgres with: Hyperdrive's pooled local connection
 * when bound, else `databaseUrl` itself. `databaseUrl` stays the database's
 * identity — the non-production URL policy always checks it, never the
 * Hyperdrive address.
 */
export function postgresConnectionString(
  env: ApiWorkerEnv,
  databaseUrl: string
): string {
  const viaHyperdrive = env.HYPERDRIVE?.connectionString.trim() ?? '';
  return viaHyperdrive.length > 0 ? viaHyperdrive : databaseUrl;
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
