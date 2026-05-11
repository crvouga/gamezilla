import { Platform } from 'react-native';

import { createExpoSecureStorage } from './impl-expo';
import { createWebSecureStorage } from './impl-web';
import type { SecureStorage } from './interface';

/**
 * Platform-specific `SecureStorage` for small encrypted-at-rest secrets:
 * - native: `expo-secure-store` (Keychain / Keystore)
 * - web: `localStorage` (no at-rest encryption — see `impl-web.ts`)
 *
 * For bulk async key-value storage (cache blobs, command queues) use
 * `createKeyValueStorage` instead — that path skips the 2048-byte cap.
 */
export function createSecureStorage(): SecureStorage {
  if (Platform.OS === 'web') {
    return createWebSecureStorage();
  }
  return createExpoSecureStorage();
}
