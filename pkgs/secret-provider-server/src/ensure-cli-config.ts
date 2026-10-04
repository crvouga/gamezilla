import { readUtf8, writeUtf8 } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import type { ResolvedSecretsScope } from '@pkgs/secrets-config-shared/defaults';
import { readSecretsConfig } from '@pkgs/secrets-config-server/secrets-scope';
import { SECRETS_DEFAULTS } from '@pkgs/secrets-config-shared/defaults';
import { INFISICAL_CLI_CONFIG_FILENAME } from '@pkgs/secret-provider-shared/defaults';
import { resolveInfisicalEndpoint } from '@pkgs/secret-provider-shared/resolve-endpoint';

/**
 * Ensure the Infisical CLI config file exists so bare `infisical` commands
 * resolve the same project as `.secrets.json`.
 *
 * `defaultEnvironment` stays pinned to the repo-configured default (file /
 * SECRETS_DEFAULTS) — never the effective `SECRETS_ENV` override — so check
 * (`dev`) vs infra (`prd`) runs do not flip a tracked file.
 */
export async function ensureInfisicalCliConfig(
  store: ObjectStore,
  scope: ResolvedSecretsScope
): Promise<void> {
  const file = await readSecretsConfig(store);
  const defaultEnvironment = file.environment?.trim() || SECRETS_DEFAULTS.env;
  const body = `${JSON.stringify(
    {
      workspaceId: scope.projectId,
      defaultEnvironment,
      domain: resolveInfisicalEndpoint(scope),
    },
    null,
    2
  )}\n`;
  if ((await readUtf8(store, INFISICAL_CLI_CONFIG_FILENAME)) === body) {
    return;
  }
  await writeUtf8(
    store,
    INFISICAL_CLI_CONFIG_FILENAME,
    body,
    'application/json'
  );
}
