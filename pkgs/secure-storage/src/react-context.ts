import { createContext, useContext } from 'react';

import type { SecureStorage } from './interface';

const SecureStorageContext = createContext<SecureStorage | null>(null);

export function useSecureStorage(): SecureStorage {
  const v = useContext(SecureStorageContext);
  if (v === null) {
    throw new Error('useSecureStorage: SecureStorageContext.Provider missing');
  }
  return v;
}

export const SecureStorageContextProvider = SecureStorageContext.Provider;
