/**
 * Stateless helper for wiping the single shared `main` SQLite database. With
 * one DB per app instance there is no per-account file to delete; this just
 * clears web persistence + reloads, or unlinks the native file.
 */
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth/client/auth-storage-keys';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { clearWebClientPersistentState } from '@pkgs/browser/clear-web-client-state';
import type { SecureStorage } from '@pkgs/secure-storage/interface';
import { RESET_DB_QUERY_PARAM } from '@pkgs/sql-client/impl-expo-sqlite';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { getMainSqliteDbName } from '../storage/open-main-sql-client';

export type PatchDbLocalDataDeps = {
  secure: SecureStorage;
};

export async function clearLocalDatabaseAndReloadWithDeps(
  d: PatchDbLocalDataDeps
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      await clearWebClientPersistentState();
      const url = new URL(window.location.href);
      url.searchParams.set(RESET_DB_QUERY_PARAM, '1');
      window.location.replace(url.toString());
    }
    return;
  }

  await writeSecureStorageItem(d.secure, SESSION_TOKEN_KEY, null);
  await writeSecureStorageItem(d.secure, LAST_LOCAL_ACCOUNT_ID_KEY, null);
  await SQLite.deleteDatabaseAsync(getMainSqliteDbName()).catch(() => {});
}
