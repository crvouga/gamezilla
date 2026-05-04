import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import { Platform } from 'react-native';

import { createExpoKeyValueStorage } from './key-value-storage-expo';
import { createWebKeyValueStorage } from './key-value-storage-web';

/**
 * Platform-specific bulk async key-value storage:
 * - web: `localStorage`
 * - native: `@react-native-async-storage/async-storage`
 *
 * For small encrypted-at-rest secrets (deviceId, session tokens) use
 * `createSecureStorage` instead — that path enforces the expo-secure-store
 * 2048-byte limit and is unsuitable for cache/queue blobs.
 */
export function createKeyValueStorage(): KeyValueStorage {
  if (Platform.OS === 'web') {
    return createWebKeyValueStorage();
  }
  return createExpoKeyValueStorage();
}
