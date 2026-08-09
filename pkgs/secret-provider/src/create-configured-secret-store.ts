// @io-wall-ok
import { wallIo } from '@pkgs/io';
import {
  createCombinedSecretStore,
  createScriptSecretStore,
  type SecretStore,
} from '@pkgs/secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config';
import { createInfisicalSecretStore } from './impl-infisical/http-secret-store';
import { resolveInfisicalAccessTokenForWrites } from './impl-infisical/oidc-access-token';
import { resolveInfisicalEndpoint } from './impl-infisical/resolve-endpoint';

/** Composition-root Io for tooling secret stores (scripts / CI). */
const toolingIo = wallIo();

export type CreateConfiguredSecretStoreOptions = {
  readonly repoRoot: string;
  readonly envOverride?: string;
  readonly token?: string;
  /** When true, compose env reads with remote writes (script/CI pattern). */
  readonly writable?: boolean;
};

/**
 * Tooling / script secret store backed by the configured secrets provider.
 * Requires `SECRETS_TOKEN` (or OIDC-minted write token when `writable`).
 */
export async function createConfiguredSecretStore(
  options: CreateConfiguredSecretStoreOptions
): Promise<SecretStore> {
  const scope = resolveSecretsScope(options.repoRoot, options.envOverride);
  const endpoint = resolveInfisicalEndpoint(scope);
  const fetchFn = toolingIo.http.fetch.bind(toolingIo.http);

  if (options.writable === true) {
    const readStore = createScriptSecretStore();
    const token =
      options.token?.trim() ||
      (await resolveInfisicalAccessTokenForWrites({
        repoRoot: options.repoRoot,
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
  readonly envOverride?: string;
  readonly token?: string;
};

/** Sync tooling store — requires an explicit or env `SECRETS_TOKEN`. */
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
    domain: resolveInfisicalEndpoint(scope),
    workspaceId: scope.projectId,
    env: scope.env,
    token,
    fetchFn: toolingIo.http.fetch.bind(toolingIo.http),
  });
}

export type CreateWritableScriptSecretStoreOptions = {
  readonly repoRoot: string;
  readonly secretsEnv?: string;
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
    ...(options.secretsEnv !== undefined
      ? { envOverride: options.secretsEnv }
      : {}),
    writable: true,
  });
}
