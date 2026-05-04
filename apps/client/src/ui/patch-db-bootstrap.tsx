import {
  deleteAccountLocalData,
  deleteAnonymousDatabaseFileBestEffort,
} from '@gamezilla/client/db/account-db';
import {
  HTTP_CLIENT_ID_STORAGE_KEY,
  ensureServerClientId,
} from '@gamezilla/client/db/ensure-server-client-id';
import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import { RuntimeBridge } from '@gamezilla/client/runtime/runtime-bridge';
import {
  accountIdAtom,
  configServiceAtom,
  secureStorageAtom,
  sessionServiceAtom,
  sessionTokenAtom,
  sqlClientAtom,
} from '@gamezilla/client/runtime/atoms';
import { isUuid } from '@gamezilla/domain/auth/device-id';
import { clearWebClientPersistentState } from '@gamezilla/lib/browser/clear-web-client-state';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { RESET_DB_QUERY_PARAM } from '@gamezilla/lib/sql-client/impl-expo-sqlite';
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
  await deleteAccountLocalData(accountId);
  await writeLastLocalAccountId(storage, null);
  const apiBase = store.get(configServiceAtom).getApiUrl();
  const clientId = await ensureServerClientId(apiBase, storage);
  await deleteAnonymousDatabaseFileBestEffort(clientId);
}

export async function clearLocalDatabaseAndReload(): Promise<void> {
  const store = getDefaultStore();
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      // SQLite on web lives in OPFS, which `clearWebClientPersistentState`
      // (IndexedDB / Service Workers / Cache Storage) does not touch. Wiping
      // OPFS while the running worker still holds access handles silently
      // fails (`NoModificationAllowedError`), so delegate to the existing
      // `?reset-db=1` recovery branch: on the next page load — before any
      // worker reopens the DB — `maybeHandleResetDbQueryParam` clears OPFS,
      // deletes the SQLite file, and strips the query param.
      await clearWebClientPersistentState();
      const url = new URL(window.location.href);
      url.searchParams.set(RESET_DB_QUERY_PARAM, '1');
      window.location.replace(url.toString());
    }
    return;
  }

  const accountId = store.get(accountIdAtom);
  const storage = store.get(secureStorageAtom);
  let anonymousClientId: string | null = null;
  if (accountId === null) {
    anonymousClientId = await storage.getItem(HTTP_CLIENT_ID_STORAGE_KEY);
  }

  store.set(accountIdAtom, null);
  store.set(sessionTokenAtom, null);
  await store.get(sqlClientAtom);

  if (accountId !== null) {
    await deleteAccountLocalData(accountId);
  } else if (
    anonymousClientId !== null &&
    anonymousClientId.length > 0 &&
    isUuid(anonymousClientId)
  ) {
    await deleteAnonymousDatabaseFileBestEffort(anonymousClientId);
  }

  await writeLastLocalAccountId(storage, null);
}

export function PatchBootstrap({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RuntimeBridge>{children}</RuntimeBridge>
    </Suspense>
  );
}
