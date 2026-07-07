import { createInfisicalSecretStore } from '@pkgs/secret-store/impl-infisical';
import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';
import { REPO_ROOT } from '../cli/paths';
import {
  PRODUCTION_SECRETS_ENV,
  assertNonProdDatabaseUrl,
} from './database-url-policy';

/** Tooling-only: fetch secrets env `prd` `DATABASE_URL` for Tiger dual-compare guards. */
export async function resolveProductionDatabaseUrlFromInfisical(): Promise<
  string | null
> {
  const token = (process.env['SECRETS_TOKEN'] ?? '').trim();
  if (token.length === 0) return null;
  try {
    const scope = resolveSecretsScope(REPO_ROOT, PRODUCTION_SECRETS_ENV);
    const store = createInfisicalSecretStore({
      domain: scope.domain,
      workspaceId: scope.workspaceId,
      env: PRODUCTION_SECRETS_ENV,
      token,
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
  const productionUrl = await resolveProductionDatabaseUrlFromInfisical();
  await assertNonProdDatabaseUrl(url, context, { productionUrl });
}

/** Like {@link assertDatabaseUrlAllowedForSecretsEnv} with Infisical prod dual-fetch. */
export async function assertDatabaseUrlAllowedForSecretsEnvForTooling(
  url: string,
  secretsEnv: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  if (secretsEnv === PRODUCTION_SECRETS_ENV) return;
  await assertNonProdDatabaseUrlForTooling(url, { ...context, secretsEnv });
}
