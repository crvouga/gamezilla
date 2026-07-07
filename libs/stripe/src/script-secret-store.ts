import {
  createCachingSecretStore,
  createScriptSecretStore,
} from '@pkgs/secret-store';
import type { SecretStore } from '@pkgs/secret-store';

/**
 * Infisical-backed store for Node/Bun CLI scripts. Reads secrets injected by
 * `secrets-run` / CI / `infisical run`.
 */
export function createStripeScriptSecretStore(): SecretStore {
  const store = createScriptSecretStore();
  return createCachingSecretStore(store, { ttlMs: 60_000 });
}
