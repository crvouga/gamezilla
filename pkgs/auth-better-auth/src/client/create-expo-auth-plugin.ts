import { expoClient } from '@better-auth/expo/client';

import type { AuthClientStorage } from './bearer-token-store';

/**
 * Production-only Better Auth Expo plugin. Loaded lazily so in-process sims
 * that inject {@link AuthClientStorage} never evaluate `@better-auth/expo/client`
 * (it installs a global ExpoOnlineManager that `import()`s expo-network after
 * Jest teardown).
 */
export function createExpoAuthPlugin(storage: AuthClientStorage) {
  return expoClient({
    scheme: 'gamezilla',
    storagePrefix: 'gamezilla',
    storage,
  });
}
