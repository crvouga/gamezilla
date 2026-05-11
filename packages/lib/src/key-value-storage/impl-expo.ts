import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStorage } from './interface';

/**
 * Native `KeyValueStorage` backed by `@react-native-async-storage/async-storage`.
 * Unlike `expo-secure-store`, AsyncStorage has no 2048-byte per-value cap, so
 * larger blobs (room committed log, command queue, …) fit without chunking.
 *
 * AsyncStorage is **not encrypted**; do not store secrets here. Use
 * `SecureStorage` (expo-secure-store) for tokens and device identifiers.
 */
export function createExpoKeyValueStorage(): KeyValueStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      return AsyncStorage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      await AsyncStorage.setItem(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      await AsyncStorage.removeItem(key);
    },
  };
}
