import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server/repo-tree-store';
import { createToolingSecretStore } from '@pkgs/secret-provider-server/create-configured-secret-store';
import { assertNonProdDatabaseUrl } from '@pkgs/database-url-policy-shared/database-url-policy';
import type { DatabaseUrlPolicyOptions } from '@pkgs/database-url-policy-shared/database-url-policy';

export type ToolingDatabaseUrlPolicyDeps = {
  readonly repoRoot: string;
  readonly fetchFn: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  /** The secrets envs that are production (the caller's decision). */
  readonly productionEnvs: readonly string[];
};

async function readDatabaseUrlOf(
  deps: ToolingDatabaseUrlPolicyDeps,
  env: string,
  token: string
): Promise<string | null> {
  try {
    const store = await createToolingSecretStore({
      repoRoot: deps.repoRoot,
      configStore: createRepoTreeObjectStore({ rootDir: deps.repoRoot }),
      envOverride: env,
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

/**
 * Tooling-only: every production secrets env's `DATABASE_URL` that can be
 * read, for Tiger dual-compare guards. Empty without `SECRETS_TOKEN`.
 */
export async function resolveProductionDatabaseUrlsFromSecretStore(
  deps: ToolingDatabaseUrlPolicyDeps
): Promise<readonly string[]> {
  const token = (process.env['SECRETS_TOKEN'] ?? '').trim();
  if (token.length === 0) return [];
  const urls = await Promise.all(
    deps.productionEnvs.map((env) => readDatabaseUrlOf(deps, env, token))
  );
  return urls.filter((url): url is string => url !== null);
}

/** Tooling entrypoints: dual-fetch production `DATABASE_URL`s when `SECRETS_TOKEN` is set. */
export async function assertNonProdDatabaseUrlForTooling(
  url: string,
  deps: ToolingDatabaseUrlPolicyDeps,
  context: Record<string, unknown> = {},
  options?: DatabaseUrlPolicyOptions
): Promise<void> {
  const productionUrls =
    await resolveProductionDatabaseUrlsFromSecretStore(deps);
  await assertNonProdDatabaseUrl(url, context, {
    productionUrls,
    ...(options?.productionHostnames !== undefined
      ? { productionHostnames: options.productionHostnames }
      : {}),
  });
}
