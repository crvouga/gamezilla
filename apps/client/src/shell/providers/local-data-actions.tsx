/** @jsxImportSource solid-js */
import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth/public/auth-storage-keys';
import { SessionCapabilityStore } from '@libs/auth/public/session-capability';
import { SyncLocalDataActionsContext } from '@libs/auth/root/client/sync-local-data-actions-context';
import { clearWebClientPersistentState } from '@pkgs/browser/clear-web-client-state';
import { useTimers } from '@pkgs/clock/solid';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { useSecureStorageStore } from '@pkgs/secure-storage/solid';
import { runWebOpfsRecoveryAndReload } from '@pkgs/sql-client-sqlite-web';
import { useSyncEngineInstance } from '@pkgs/sync-engine/solid';
import { createMemo, type JSX } from 'solid-js';

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

  const deps: SyncLocalDataDeps = createMemo(() => ({
    store,
    clearLocalData: () => engine.clearLocalData(),
    wipeWebOpfsAndReload: () =>
      runWebOpfsRecoveryAndReload({
        timers,
        returnTo: '/',
      }),
  }))();

  const actions = createMemo(() => ({
    clearLocalDatabaseAndReload: () =>
      clearLocalDatabaseAndReloadWithDeps(deps),
  }))();

  return (
    <SyncLocalDataActionsContext.Provider value={actions}>
      {props.children}
    </SyncLocalDataActionsContext.Provider>
  );
}
