import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readSecretsConfig,
  SECRETS_DEFAULTS,
  type ResolvedSecretsScope,
} from '@pkgs/secrets-config';
import { INFISICAL_CLI_CONFIG_FILENAME } from './defaults';
import { resolveInfisicalEndpoint } from './resolve-endpoint';

/**
 * Ensure the Infisical CLI config file exists so bare `infisical` commands
 * resolve the same project as `.secrets.json`.
 *
 * `defaultEnvironment` stays pinned to the repo-configured default (file /
 * SECRETS_DEFAULTS) — never the effective `SECRETS_ENV` override — so check
 * (`dev`) vs infra (`prd`) runs do not flip a tracked file.
 */
export function ensureInfisicalCliConfig(
  repoRoot: string,
  scope: ResolvedSecretsScope
): void {
  const path = join(repoRoot, INFISICAL_CLI_CONFIG_FILENAME);
  const file = readSecretsConfig(repoRoot);
  const defaultEnvironment =
    file.environment?.trim() || SECRETS_DEFAULTS.env;
  const body = `${JSON.stringify(
    {
      workspaceId: scope.projectId,
      defaultEnvironment,
      domain: resolveInfisicalEndpoint(scope),
    },
    null,
    2
  )}\n`;
  if (existsSync(path) && readFileSync(path, 'utf8') === body) {
    return;
  }
  writeFileSync(path, body, 'utf8');
}
