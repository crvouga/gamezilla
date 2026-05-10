import { createContext, useContext } from 'react';

/**
 * Bulk async key-value storage. Use for cache/queue blobs that can grow
 * beyond a few KB (e.g. room committed log + outbound command queue).
 *
 * Backed by `localStorage` on web and `@react-native-async-storage/async-storage`
 * on native. Unlike {@link SecureStorage} (expo-secure-store), there is no
 * 2048 UTF-8 byte per-value cap. Values are NOT encrypted on disk; do not
 * store secrets here.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

const KeyValueStorageContext = createContext<KeyValueStorage | null>(null);

export function useKeyValueStorage(): KeyValueStorage {
  const v = useContext(KeyValueStorageContext);
  if (v === null) {
    throw new Error(
      'useKeyValueStorage: KeyValueStorageContext.Provider missing'
    );
  }
  return v;
}

export const KeyValueStorageContextProvider = KeyValueStorageContext.Provider;
