import type { SecretStore } from '@pkgs/secret-store';
import {
  createCachingSecretStore,
  createCombinedSecretStore,
  createRecordSecretStore,
  VaultSecretStore,
} from '@pkgs/secret-store';

export type CreateApiSecretStoreOptions = {
  readonly project?: string | null;
  readonly config?: string | null;
  readonly addr?: string | null;
  /** `.dev.vars` mirrors — preferred over live Vault reads when set. */
  readonly devBindings?: Readonly<Record<string, string>>;
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
  const vault = new VaultSecretStore({
    token,
    ...optionalField('project', options.project),
    ...optionalField('config', options.config),
    ...optionalField('addr', options.addr),
  });
  const devBindings = options.devBindings ?? {};
  const inner =
    Object.keys(devBindings).length > 0
      ? createCombinedSecretStore(createRecordSecretStore(devBindings), vault)
      : vault;
  return createCachingSecretStore(inner, { ttlMs: 300_000 });
}
