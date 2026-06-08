import {
  createCachingSecretStore,
  createVaultSecretStoreForScripts,
} from '@pkgs/secret-store';
import type { SecretStore } from '@pkgs/secret-store';

/**
 * Vault-backed store for Node/Bun CLI scripts. Uses `VAULT_TOKEN` or
 * `~/.vault-token` — config is implied by `.vault.yaml` / `VAULT_CONFIG`.
 */
export function createStripeScriptSecretStore(): SecretStore {
  const store = createVaultSecretStoreForScripts();
  return createCachingSecretStore(store, { ttlMs: 60_000 });
}
