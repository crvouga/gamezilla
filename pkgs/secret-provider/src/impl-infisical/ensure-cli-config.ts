import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedSecretsScope } from '@pkgs/secrets-config';
import { INFISICAL_CLI_CONFIG_FILENAME } from './defaults';
import { resolveInfisicalEndpoint } from './resolve-endpoint';

/**
 * Ensure the Infisical CLI config file exists so `infisical run` / `secrets`
 * resolve the same project as `.secrets.json`.
 */
export function ensureInfisicalCliConfig(
  repoRoot: string,
  scope: ResolvedSecretsScope
): void {
  const path = join(repoRoot, INFISICAL_CLI_CONFIG_FILENAME);
  const body = `${JSON.stringify(
    {
      workspaceId: scope.projectId,
      defaultEnvironment: scope.env,
      domain: resolveInfisicalEndpoint(scope),
    },
    null,
    2
  )}\n`;
  writeFileSync(path, body, 'utf8');
}
