import type { SecretStore } from '@gamezilla/lib/secret-store';
import {
  createCachingSecretStore,
  DopplerSecretStore,
} from '@gamezilla/lib/secret-store';

/**
 * Single Doppler config `shared`; used only for secrets that are not
 * deployment-scoped URLs (e.g. OAuth client id).
 */
export function createApiSecretStore(token: string): SecretStore {
  const store = new DopplerSecretStore({ token, configName: 'shared' });
  return createCachingSecretStore(store, { ttlMs: 60_000 });
}
