import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth/client/auth-storage-keys';
import { SyncLocalDataActionsContext } from '@libs/auth/client/sync-local-data-actions-context';
import { clearWebClientPersistentState } from '@pkgs/browser/clear-web-client-state';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import {
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import { useSyncEngineInstance } from '@pkgs/sync-engine/client/sync-engine-context';
import { type ReactNode, useMemo } from 'react';
import { Platform } from 'react-native';

export type SyncLocalDataDeps = {
  readonly store: SecureStorageStore;
  readonly clearLocalData: () => Promise<void>;
};

/** Wipes re-hydratable local data and reloads web or clears native session keys. */
export async function clearLocalDatabaseAndReloadWithDeps(
  d: SyncLocalDataDeps
): Promise<void> {
  await d.clearLocalData();

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      await clearWebClientPersistentState();
      window.location.reload();
    }
    return;
  }

  await writeSecureStorageItem(d.store, SESSION_TOKEN_KEY, null);
  await writeSecureStorageItem(d.store, LAST_LOCAL_ACCOUNT_ID_KEY, null);
}

export function SyncLocalDataActions({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const store = useSecureStorageStore();
  const engine = useSyncEngineInstance();

  const deps: SyncLocalDataDeps = useMemo(
    () => ({
      store,
      clearLocalData: () => engine.clearLocalData(),
    }),
    [store, engine]
  );

  const actions = useMemo(
    () => ({
      clearLocalDatabaseAndReload: () =>
        clearLocalDatabaseAndReloadWithDeps(deps),
    }),
    [deps]
  );

  return (
    <SyncLocalDataActionsContext.Provider value={actions}>
      {children}
    </SyncLocalDataActionsContext.Provider>
  );
}
