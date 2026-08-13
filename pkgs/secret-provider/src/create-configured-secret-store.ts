import {
  createCombinedSecretStore,
  createScriptSecretStore,
  type SecretStore,
} from '@pkgs/secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config';
import type { ObjectStore } from '@pkgs/object-store/interface';
import {
  createInfisicalSecretStore,
  type InfisicalFetch,
} from './impl-infisical/http-secret-store';
import { resolveInfisicalAccessTokenForWrites } from './impl-infisical/oidc-access-token';
import { resolveInfisicalEndpoint } from './impl-infisical/resolve-endpoint';

export type CreateConfiguredSecretStoreOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly envOverride?: string;
  readonly token?: string;
  /** When true, compose env reads with remote writes (script/CI pattern). */
  readonly writable?: boolean;
  /** Injected HTTP transport (composition root supplies wall/script fetch). */
  readonly fetchFn: InfisicalFetch;
};

/**
 * Tooling / script secret store backed by the configured secrets provider.
 * Requires `SECRETS_TOKEN` (or OIDC-minted write token when `writable`).
 */
export async function createConfiguredSecretStore(
  options: CreateConfiguredSecretStoreOptions
): Promise<SecretStore> {
  const scope = await resolveSecretsScope(
    options.configStore,
    options.envOverride
  );
  const endpoint = resolveInfisicalEndpoint(scope);
  const { fetchFn } = options;

  if (options.writable === true) {
    const readStore = createScriptSecretStore();
    const token =
      options.token?.trim() ||
      (await resolveInfisicalAccessTokenForWrites({
        repoRoot: options.repoRoot,
        configStore: options.configStore,
        secretsEnv: scope.env,
      }));
    if (token === null || token.length === 0) {
      return readStore;
    }
    const writeStore = createInfisicalSecretStore({
      domain: endpoint,
      workspaceId: scope.projectId,
      env: scope.env,
      token,
      fetchFn,
    });
    return createCombinedSecretStore(writeStore, readStore);
  }

  const token = (options.token ?? process.env['SECRETS_TOKEN'] ?? '').trim();
  if (token.length === 0) {
    throw new Error(
      'SECRETS_TOKEN is required for tooling secret store access'
    );
  }
  return createInfisicalSecretStore({
    domain: endpoint,
    workspaceId: scope.projectId,
    env: scope.env,
    token,
    fetchFn,
  });
}

export type CreateToolingSecretStoreOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly envOverride?: string;
  readonly token?: string;
  readonly fetchFn: InfisicalFetch;
};

/** Tooling store — requires an explicit or env `SECRETS_TOKEN`. */
export async function createToolingSecretStore(
  options: CreateToolingSecretStoreOptions
): Promise<SecretStore> {
  const scope = await resolveSecretsScope(
    options.configStore,
    options.envOverride
  );
  const token = (options.token ?? process.env['SECRETS_TOKEN'] ?? '').trim();
  if (token.length === 0) {
    throw new Error(
      'SECRETS_TOKEN is required for tooling secret store access'
    );
  }
  return createInfisicalSecretStore({
    domain: resolveInfisicalEndpoint(scope),
    workspaceId: scope.projectId,
    env: scope.env,
    token,
    fetchFn: options.fetchFn,
  });
}

export type CreateWritableScriptSecretStoreOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly secretsEnv?: string;
  readonly fetchFn: InfisicalFetch;
};

/**
 * Script-side store: reads from injected env, writes via the configured
 * provider when a bearer token is available (`SECRETS_TOKEN` / GitHub OIDC).
 */
export async function createWritableScriptSecretStore(
  options: CreateWritableScriptSecretStoreOptions
): Promise<SecretStore> {
  return createConfiguredSecretStore({
    repoRoot: options.repoRoot,
    configStore: options.configStore,
    ...(options.secretsEnv !== undefined
      ? { envOverride: options.secretsEnv }
      : {}),
    writable: true,
    fetchFn: options.fetchFn,
  });
}
