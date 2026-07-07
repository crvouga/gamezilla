import type { SecretStore } from '@pkgs/secret-store/interface';
import { createInfisicalSecretStore } from '@pkgs/secret-store/impl-infisical';
import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';

export type CreateToolingSecretStoreOptions = {
  readonly repoRoot: string;
  readonly envOverride?: string;
  readonly token?: string;
};

/**
 * Tooling-only secret store for infra CLI and setup scripts.
 * Requires `SECRETS_TOKEN` or an explicit token (service token / access token).
 */
export function createToolingSecretStore(
  options: CreateToolingSecretStoreOptions
): SecretStore {
  const scope = resolveSecretsScope(options.repoRoot, options.envOverride);
  const token = (options.token ?? process.env['SECRETS_TOKEN'] ?? '').trim();
  if (token.length === 0) {
    throw new Error(
      'SECRETS_TOKEN is required for tooling secret store access'
    );
  }
  return createInfisicalSecretStore({
    domain: scope.domain,
    workspaceId: scope.workspaceId,
    env: scope.env,
    token,
  });
}
