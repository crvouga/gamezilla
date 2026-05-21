/**
 * Stateless helper for wiping the single shared `main` SQLite database. With
 * one DB per app instance there is no per-account file to delete; this just
 * clears web persistence + reloads, or unlinks the native file.
 */
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@gamezilla/auth/client/auth-storage-keys';
import { writeSecureStorageItem } from '@gamezilla/secure-storage/use-secure-storage-item';
import { clearWebClientPersistentState } from '@gamezilla/browser/clear-web-client-state';
import type { SecureStorage } from '@gamezilla/secure-storage/interface';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { MAIN_SQLITE_DB_NAME } from '../storage/open-main-sql-client';

export type PatchDbLocalDataDeps = {
  secure: SecureStorage;
};

export async function clearLocalDatabaseAndReloadWithDeps(
  d: PatchDbLocalDataDeps
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      await clearWebClientPersistentState();
      window.location.reload();
    }
    return;
  }

  await writeSecureStorageItem(d.secure, SESSION_TOKEN_KEY, null);
  await writeSecureStorageItem(d.secure, LAST_LOCAL_ACCOUNT_ID_KEY, null);
  await SQLite.deleteDatabaseAsync(MAIN_SQLITE_DB_NAME).catch(() => {});
}
