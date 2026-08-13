import { createSecureStorage } from '@pkgs/secure-storage/create';
import { SecureStorageContextProvider } from '@pkgs/secure-storage/interface';
import {
  createSecureStorageStore,
  type SecureStorageStore,
} from '@pkgs/secure-storage/secure-storage-store';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage/use-secure-storage-item';
import type { ReactNode } from 'react';

import { useClientSystemResources } from '../client-system-resources';

/**
 * App-lifetime secure-storage store.
 *
 * Module-level (not `useRef` / `useMemo`): `AppSecureStorage` sits under
 * `AppSuspenseRoot`, and `useHydratedSecureStorageItem` suspends on first
 * read. A component that suspends before commit discards hook state — so a
 * ref-held store is recreated on every Suspense retry, hydration never sticks,
 * and the root spinner loops forever. Same rationale as `useCachedPromise`.
 */
let appSecureStorageStore: SecureStorageStore | null = null;

function getAppSecureStorageStore(): SecureStorageStore {
  if (appSecureStorageStore === null) {
    appSecureStorageStore = createSecureStorageStore(createSecureStorage());
  }
  return appSecureStorageStore;
}

export function AppSecureStorage({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  // Sims inject a per-actor in-memory store; production uses the app-lifetime store.
  const store =
    useClientSystemResources().secureStorageStore ?? getAppSecureStorageStore();
  return (
    <SecureStorageContextProvider value={store.storage}>
      <SecureStorageStoreProvider value={store}>
        {children}
      </SecureStorageStoreProvider>
    </SecureStorageContextProvider>
  );
}
