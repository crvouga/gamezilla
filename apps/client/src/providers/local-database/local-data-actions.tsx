import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth/public/auth-storage-keys';
import { SessionCapabilityStore } from '@libs/auth/public/session-capability';
import { SyncLocalDataActionsContext } from '@libs/auth/root/client/sync-local-data-actions-context';
import { clearWebClientPersistentState } from '@pkgs/browser/clear-web-client-state';
import { useTimers } from '@pkgs/clock';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import {
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import { runWebOpfsRecoveryAndReload } from '@pkgs/sql-client-sqlite-web';
import { useSyncEngineInstance } from '@pkgs/sync-engine/client';
import { type ReactNode, useMemo } from 'react';
import { Platform } from 'react-native';

export type SyncLocalDataDeps = {
  readonly store: SecureStorageStore;
  readonly clearLocalData: () => Promise<void>;
  readonly wipeWebOpfsAndReload: () => Promise<void>;
};

/** Wipes re-hydratable local data and reloads web or clears native session keys. */
export async function clearLocalDatabaseAndReloadWithDeps(
  d: SyncLocalDataDeps
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      await clearWebClientPersistentState();
    }
    // In-process OPFS wipe (iframe teardown + directory clear), then reload.
    await d.wipeWebOpfsAndReload();
    return;
  }

  await d.clearLocalData();
  await new SessionCapabilityStore(d.store).clear();
  await writeSecureStorageItem(d.store, LAST_LOCAL_ACCOUNT_ID_KEY, null);
}

export function SyncLocalDataActions({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const store = useSecureStorageStore();
  const engine = useSyncEngineInstance();
  const timers = useTimers();

  const deps: SyncLocalDataDeps = useMemo(
    () => ({
      store,
      clearLocalData: () => engine.clearLocalData(),
      wipeWebOpfsAndReload: () =>
        runWebOpfsRecoveryAndReload({
          timers,
          returnTo: '/',
        }),
    }),
    [store, engine, timers]
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
