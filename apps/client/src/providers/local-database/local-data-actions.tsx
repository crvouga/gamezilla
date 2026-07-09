import { SyncLocalDataActionsContext } from '@libs/auth/client/sync-local-data-actions-context';
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth/client/auth-storage-keys';
import { clearWebClientPersistentState } from '@pkgs/browser/clear-web-client-state';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import type { SecureStorage } from '@pkgs/secure-storage/interface';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';

export type SyncLocalDataDeps = {
  readonly secure: SecureStorage;
  readonly clearLocalData: () => Promise<void>;
};

/** Wipes PowerSync local data and reloads the app (web) or clears session keys (native). */
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

  await writeSecureStorageItem(d.secure, SESSION_TOKEN_KEY, null);
  await writeSecureStorageItem(d.secure, LAST_LOCAL_ACCOUNT_ID_KEY, null);
}

export function SyncLocalDataActions({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const secure = useSecureStorage();
  const engine = useSyncEngine();

  const deps: SyncLocalDataDeps = useMemo(
    () => ({
      secure,
      clearLocalData: () => engine.clearLocalData(),
    }),
    [secure, engine]
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
