/**
 * Lifecycle helpers for the local PatchDB stack: clear & reload, remove
 * per-account data. Invoked from app composition (Settings → Developer) and
 * account management.
 */
import { getRegisteredClientStore } from '@gamezilla/auth/client/client-store-register';
import { getRuntimeFactories } from '@gamezilla/auth/client/runtime-factories';
import { clearWebClientPersistentState } from '@gamezilla/lib/browser/clear-web-client-state';
import { Platform } from 'react-native';

import { enqueueSqlClientLifecycle } from './sql-client-lifecycle';

/**
 * Native: clears session, switches to anonymous SQLite, deletes the account's
 * database file, and clears last-local-account metadata.
 */
export async function removeLocalDataForAccount(
  accountId: string
): Promise<void> {
  const store = getRegisteredClientStore();
  const factories = getRuntimeFactories();
  const storage = store.getSecureStorage();
  const sessionSvc = await store.getSessionService();
  await sessionSvc.clearSession();
  store.setAccountId(null);
  store.setSessionToken(null);
  await store.getPatchDbStack();
  await enqueueSqlClientLifecycle(() =>
    factories.deleteAccountLocalData(accountId)
  );
  await factories.writeLastLocalAccountId(storage, null);
  const deviceService = await store.getDeviceService();
  await enqueueSqlClientLifecycle(() =>
    factories.deleteAnonymousDatabaseFileBestEffort(deviceService.getDeviceId())
  );
}

export async function clearLocalDatabaseAndReload(): Promise<void> {
  const store = getRegisteredClientStore();
  const factories = getRuntimeFactories();
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      await clearWebClientPersistentState();
      window.location.reload();
    }
    return;
  }

  const accountId = store.getAccountId();
  const storage = store.getSecureStorage();
  const deviceService = await store.getDeviceService();

  store.setAccountId(null);
  store.setSessionToken(null);
  await store.getPatchDbStack();
  await enqueueSqlClientLifecycle(async () => {
    if (accountId !== null) {
      await factories.deleteAccountLocalData(accountId);
    } else {
      await factories.deleteAnonymousDatabaseFileBestEffort(
        deviceService.getDeviceId()
      );
    }
  });

  await factories.writeLastLocalAccountId(storage, null);
}
