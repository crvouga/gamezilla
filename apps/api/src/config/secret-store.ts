import type { SecretStore } from '@gamezilla/lib/secret-store';
import {
  createCachingSecretStore,
  DopplerSecretStore,
} from '@gamezilla/lib/secret-store';

/**
 * Doppler secrets for this Worker. Config (`local` vs `prod`) is implied by the
 * config-scoped `DOPPLER_TOKEN` — no `config` query param.
 */
export function createApiSecretStore(token: string): SecretStore {
  const store = new DopplerSecretStore({ token });
  return createCachingSecretStore(store, { ttlMs: 300_000 });
}
