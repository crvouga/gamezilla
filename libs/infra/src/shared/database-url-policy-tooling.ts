import { createRepoTreeObjectStore } from '@pkgs/object-store/repo-tree-store';
import { createToolingSecretStore } from '@pkgs/secret-provider';
import { cliHttp } from '../cli/lib/cli-io';
import { REPO_ROOT } from '../cli/paths';
import {
  assertNonProdDatabaseUrl,
  PRODUCTION_SECRETS_ENV,
} from './database-url-policy';

/** Tooling-only: fetch secrets env `prd` `DATABASE_URL` for Tiger dual-compare guards. */
export async function resolveProductionDatabaseUrlFromSecretStore(): Promise<
  string | null
> {
  const token = (process.env['SECRETS_TOKEN'] ?? '').trim();
  if (token.length === 0) return null;
  try {
    const store = await createToolingSecretStore({
      repoRoot: REPO_ROOT,
      configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
      envOverride: PRODUCTION_SECRETS_ENV,
      token,
      fetchFn: cliHttp.fetch.bind(cliHttp),
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
  context: Record<string, unknown> = {}
): Promise<void> {
  const productionUrl = await resolveProductionDatabaseUrlFromSecretStore();
  await assertNonProdDatabaseUrl(url, context, { productionUrl });
}

/** Like {@link assertDatabaseUrlAllowedForSecretsEnv} with secret-store prod dual-fetch. */
export async function assertDatabaseUrlAllowedForSecretsEnvForTooling(
  url: string,
  secretsEnv: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  if (secretsEnv === PRODUCTION_SECRETS_ENV) return;
  await assertNonProdDatabaseUrlForTooling(url, { ...context, secretsEnv });
}
