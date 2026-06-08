import type { SecretStore } from '@pkgs/secret-store';
import {
  createCachingSecretStore,
  VaultSecretStore,
} from '@pkgs/secret-store';

export type CreateApiSecretStoreOptions = {
  readonly project?: string | null;
  readonly config?: string | null;
  readonly addr?: string | null;
};

function optionalField<K extends string>(
  key: K,
  value: string | null | undefined
): Partial<Record<K, string>> {
  return value !== undefined && value !== null
    ? ({ [key]: value } as Partial<Record<K, string>>)
    : {};
}

/**
 * Vault KV secrets for this Worker. `setup-dev-vars` writes `VAULT_TOKEN`
 * plus `VAULT_PROJECT`/`VAULT_CONFIG` into `.dev.vars` for local dev.
 */
export function createApiSecretStore(
  token: string,
  options: CreateApiSecretStoreOptions = {}
): SecretStore {
  const store = new VaultSecretStore({
    token,
    ...optionalField('project', options.project),
    ...optionalField('config', options.config),
    ...optionalField('addr', options.addr),
  });
  return createCachingSecretStore(store, { ttlMs: 300_000 });
}
