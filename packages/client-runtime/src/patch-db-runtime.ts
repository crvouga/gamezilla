/**
 * Lifecycle helpers for the local PatchDB stack: clear & reload, remove
 * per-account data. These run in app composition contexts (Settings →
 * Developer) so they live alongside the atoms they touch.
 */
import { clearWebClientPersistentState } from '@gamezilla/lib/browser/clear-web-client-state';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { getDefaultStore } from 'jotai';
import { Platform } from 'react-native';
import {
  accountIdAtom,
  deviceServiceAtom,
  enqueueSqlClientLifecycle,
  secureStorageAtom,
  sessionServiceAtom,
  sessionTokenAtom,
  sqlClientAtom,
} from './atoms';
import { getRuntimeFactories } from './runtime-factories';

/**
 * Native: clears session, switches to anonymous SQLite via atoms, deletes the
 * account's database file, and clears last-local-account metadata.
 */
export async function removeLocalDataForAccount(
  accountId: string,
  storage: SecureStorage
): Promise<void> {
  const store = getDefaultStore();
  const factories = getRuntimeFactories();
  const sessionSvc = await store.get(sessionServiceAtom);
  await sessionSvc.clearSession();
  store.set(accountIdAtom, null);
  store.set(sessionTokenAtom, null);
  await store.get(sqlClientAtom);
  await enqueueSqlClientLifecycle(() =>
    factories.deleteAccountLocalData(accountId)
  );
  await factories.writeLastLocalAccountId(storage, null);
  const deviceService = await store.get(deviceServiceAtom);
  await enqueueSqlClientLifecycle(() =>
    factories.deleteAnonymousDatabaseFileBestEffort(deviceService.getDeviceId())
  );
}

export async function clearLocalDatabaseAndReload(): Promise<void> {
  const store = getDefaultStore();
  const factories = getRuntimeFactories();
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      await clearWebClientPersistentState();
      window.location.reload();
    }
    return;
  }

  const accountId = store.get(accountIdAtom);
  const storage = store.get(secureStorageAtom);
  const deviceService = await store.get(deviceServiceAtom);

  store.set(accountIdAtom, null);
  store.set(sessionTokenAtom, null);
  await store.get(sqlClientAtom);
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
