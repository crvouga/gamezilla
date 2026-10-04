/** @jsxImportSource solid-js */
import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { SessionCapabilityStore } from '@libs/auth-shared/session-capability';
import { SyncLocalDataActionsContext } from '@libs/auth-client/sync-local-data-actions-context';
import { clearWebClientPersistentState } from '@pkgs/browser-client/clear-web-client-state';
import { useTimers } from '@pkgs/clock-client/solid';
import type { SecureStorageStore } from '@pkgs/secure-storage-shared/secure-storage-store';
import { useSecureStorageStore } from '@pkgs/secure-storage-client/solid';
import { runWebOpfsRecoveryAndReload } from '@pkgs/sql-client-sqlite-web-shared/recover-in-process';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client/sync-engine-context';
import type { JSX } from 'solid-js';

export type SyncLocalDataDeps = {
  readonly store: SecureStorageStore;
  readonly clearLocalData: () => Promise<void>;
  readonly wipeWebOpfsAndReload: () => Promise<void>;
};

/** Wipes re-hydratable local data and reloads web or clears native session keys. */
export async function clearLocalDatabaseAndReloadWithDeps(
  d: SyncLocalDataDeps
): Promise<void> {
  if (typeof window !== 'undefined') {
    await clearWebClientPersistentState();
  }
  await d.wipeWebOpfsAndReload();
  await d.clearLocalData();
  await new SessionCapabilityStore(d.store).clear();
  await d.store.write(LAST_LOCAL_ACCOUNT_ID_KEY, null);
}

export function SyncLocalDataActions(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const store = useSecureStorageStore();
  const engine = useSyncEngineInstance();
  const timers = useTimers();

  const deps: SyncLocalDataDeps = {
    store,
    clearLocalData: () => engine.clearLocalData(),
    wipeWebOpfsAndReload: () =>
      runWebOpfsRecoveryAndReload({
        timers,
        returnTo: '/',
      }),
  };

  const actions = {
    clearLocalDatabaseAndReload: () =>
      clearLocalDatabaseAndReloadWithDeps(deps),
  };

  return (
    <SyncLocalDataActionsContext.Provider value={actions}>
      {props.children}
    </SyncLocalDataActionsContext.Provider>
  );
}
