import {
  deleteAccountLocalData,
  deleteAnonymousDatabaseFileBestEffort,
} from '@gamezilla/client/db/account-db';
import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import { RuntimeBridge } from '@gamezilla/client/runtime/runtime-bridge';
import {
  accountIdAtom,
  deviceServiceAtom,
  enqueueSqlClientLifecycle,
  secureStorageAtom,
  sessionServiceAtom,
  sessionTokenAtom,
  sqlClientAtom,
} from '@gamezilla/client/runtime/atoms';
import { clearWebClientPersistentState } from '@gamezilla/lib/browser/clear-web-client-state';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { getDefaultStore } from 'jotai';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Platform } from 'react-native';

/**
 * Native: clears session, switches to anonymous SQLite via atoms, deletes the
 * account's database file, and clears last-local-account metadata.
 */
export async function removeLocalDataForAccount(
  accountId: string,
  storage: SecureStorage
): Promise<void> {
  const store = getDefaultStore();
  const sessionSvc = await store.get(sessionServiceAtom);
  await sessionSvc.clearSession();
  store.set(accountIdAtom, null);
  store.set(sessionTokenAtom, null);
  await store.get(sqlClientAtom);
  await enqueueSqlClientLifecycle(() => deleteAccountLocalData(accountId));
  await writeLastLocalAccountId(storage, null);
  const deviceService = await store.get(deviceServiceAtom);
  await enqueueSqlClientLifecycle(() =>
    deleteAnonymousDatabaseFileBestEffort(deviceService.getDeviceId())
  );
}

export async function clearLocalDatabaseAndReload(): Promise<void> {
  const store = getDefaultStore();
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      // The web client's SQLite is in-memory sql.js (one DB per tab), so a
      // reload alone wipes it. We still need `clearWebClientPersistentState`
      // for IndexedDB / Service Workers / Cache Storage that survive reload.
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
      await deleteAccountLocalData(accountId);
    } else {
      await deleteAnonymousDatabaseFileBestEffort(deviceService.getDeviceId());
    }
  });

  await writeLastLocalAccountId(storage, null);
}

export function PatchBootstrap({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RuntimeBridge>{children}</RuntimeBridge>
    </Suspense>
  );
}
