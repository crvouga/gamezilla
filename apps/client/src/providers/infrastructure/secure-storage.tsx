import { useClientEnv } from '@apps/client/product/client-env-provider';
import { SecureStorageContextProvider } from '@pkgs/secure-storage/interface';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage/use-secure-storage-item';
import type { ReactNode } from 'react';

export function AppSecureStorage({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const store = useClientEnv().secureStorage;
  return (
    <SecureStorageContextProvider value={store.storage}>
      <SecureStorageStoreProvider value={store}>
        {children}
      </SecureStorageStoreProvider>
    </SecureStorageContextProvider>
  );
}
