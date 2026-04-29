import {
  createCachingSecretStore,
  createDopplerSecretStoreForScripts,
} from '@gamezilla/lib/secret-store';
import type { SecretStore } from '@gamezilla/lib/secret-store';

/**
 * Doppler-backed store for Node/Bun CLI scripts. Uses `DOPPLER_TOKEN` or
 * `doppler configure get token` — config is implied by the token (local vs prod).
 */
export function createStripeScriptSecretStore(): SecretStore {
  const store = createDopplerSecretStoreForScripts();
  return createCachingSecretStore(store, { ttlMs: 60_000 });
}
