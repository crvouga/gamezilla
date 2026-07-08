import type { SecretStore } from './interface';
import { createCombinedSecretStore } from './combined-secret-store';
import { createScriptSecretStore } from './create-script-secret-store';
import { createInfisicalSecretStore } from './impl-infisical';
import { resolveInfisicalAccessTokenForWrites } from './github-oidc-infisical-access-token';
import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';
import { join } from 'node:path';

export type CreateWritableScriptSecretStoreOptions = {
  readonly repoRoot?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly secretsEnv?: string;
};

/**
 * Script-side store: reads from injected env, writes via Infisical API when a
 * bearer token is available (SECRETS_TOKEN / GitHub OIDC during deploy).
 */
export async function createWritableScriptSecretStore(
  options: CreateWritableScriptSecretStoreOptions = {}
): Promise<SecretStore> {
  const env = options.env ?? process.env;
  const readStore = createScriptSecretStore(env);
  const repoRoot = options.repoRoot ?? join(import.meta.dirname, '../..');
  const secretsEnv =
    options.secretsEnv?.trim() ||
    (env['SECRETS_ENV'] ?? '').trim() ||
    resolveSecretsScope(repoRoot).env;

  const token = await resolveInfisicalAccessTokenForWrites({
    repoRoot,
    secretsEnv,
  });
  if (token === null) {
    return readStore;
  }

  const scope = resolveSecretsScope(repoRoot, secretsEnv);
  const writeStore = createInfisicalSecretStore({
    domain: scope.domain,
    workspaceId: scope.workspaceId,
    env: scope.env,
    token,
  });
  return createCombinedSecretStore(writeStore, readStore);
}
