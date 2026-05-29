import {
  createCachingSecretStore,
  createDopplerSecretStoreForScripts,
} from '@pkgs/secret-store';
import type { SecretStore } from '@pkgs/secret-store';

/**
 * Doppler-backed store for Node/Bun CLI scripts. Uses `DOPPLER_TOKEN` or
 * `doppler configure get token` — config is implied by the token (dev vs prd).
 */
export function createStripeScriptSecretStore(): SecretStore {
  const store = createDopplerSecretStoreForScripts();
  return createCachingSecretStore(store, { ttlMs: 60_000 });
}
