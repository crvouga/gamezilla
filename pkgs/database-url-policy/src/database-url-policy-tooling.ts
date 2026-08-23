import { createRepoTreeObjectStore } from '@pkgs/object-store/repo-tree-store';
import { createToolingSecretStore } from '@pkgs/secret-provider';
import {
  assertNonProdDatabaseUrl,
  type DatabaseUrlPolicyOptions,
  PRODUCTION_SECRETS_ENV,
} from './database-url-policy';

export type ToolingDatabaseUrlPolicyDeps = {
  readonly repoRoot: string;
  readonly fetchFn: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
};

/** Tooling-only: fetch secrets env `prd` `DATABASE_URL` for Tiger dual-compare guards. */
export async function resolveProductionDatabaseUrlFromSecretStore(
  deps: ToolingDatabaseUrlPolicyDeps
): Promise<string | null> {
  const token = (process.env['SECRETS_TOKEN'] ?? '').trim();
  if (token.length === 0) return null;
  try {
    const store = await createToolingSecretStore({
      repoRoot: deps.repoRoot,
      configStore: createRepoTreeObjectStore({ rootDir: deps.repoRoot }),
      envOverride: PRODUCTION_SECRETS_ENV,
      token,
      fetchFn: deps.fetchFn,
    });
    const raw =
      (await store.getOptional('DATABASE_URL'))?.readSecretValue() ?? '';
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/** Tooling entrypoints: dual-fetch prod `DATABASE_URL` when `SECRETS_TOKEN` is set. */
export async function assertNonProdDatabaseUrlForTooling(
  url: string,
  deps: ToolingDatabaseUrlPolicyDeps,
  context: Record<string, unknown> = {},
  options?: DatabaseUrlPolicyOptions
): Promise<void> {
  const productionUrl = await resolveProductionDatabaseUrlFromSecretStore(deps);
  await assertNonProdDatabaseUrl(url, context, {
    productionUrl,
    ...(options?.productionHostnames !== undefined
      ? { productionHostnames: options.productionHostnames }
      : {}),
  });
}

export type ToolingDatabaseUrlPolicyCall = {
  readonly deps: ToolingDatabaseUrlPolicyDeps;
  readonly context?: Record<string, unknown>;
  readonly options?: DatabaseUrlPolicyOptions;
};

/** Like {@link assertDatabaseUrlAllowedForSecretsEnv} with secret-store prod dual-fetch. */
export async function assertDatabaseUrlAllowedForSecretsEnvForTooling(
  url: string,
  secretsEnv: string,
  call: ToolingDatabaseUrlPolicyCall
): Promise<void> {
  if (secretsEnv === PRODUCTION_SECRETS_ENV) return;
  await assertNonProdDatabaseUrlForTooling(
    url,
    call.deps,
    { ...call.context, secretsEnv },
    call.options
  );
}
