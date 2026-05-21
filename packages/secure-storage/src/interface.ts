import { createContext, useContext } from 'react';

/**
 * Key-value storage with async API. Used for deviceId (native: SecureStore, web: localStorage).
 */
export interface SecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

const SecureStorageContext = createContext<SecureStorage | null>(null);

export function useSecureStorage(): SecureStorage {
  const v = useContext(SecureStorageContext);
  if (v === null) {
    throw new Error('useSecureStorage: SecureStorageContext.Provider missing');
  }
  return v;
}

export const SecureStorageContextProvider = SecureStorageContext.Provider;
