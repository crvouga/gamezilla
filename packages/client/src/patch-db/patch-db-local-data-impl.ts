/**
 * Stateless helper for wiping the single shared `main` SQLite database. With
 * one DB per app instance there is no per-account file to delete; this just
 * clears web persistence + reloads, or unlinks the native file.
 */
import { writeLastLocalAccountId } from '@gamezilla/auth/client/account-local-state';
import type { AccountIdModel } from '@gamezilla/auth/client/account-id-context';
import type { SessionTokenModel } from '@gamezilla/auth/client/session-token-context';
import { clearWebClientPersistentState } from '@gamezilla/lib/browser/clear-web-client-state';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { MAIN_SQLITE_DB_NAME } from '../storage/open-main-sql-client';

export type PatchDbLocalDataDeps = {
  secure: SecureStorage;
  sessionToken: SessionTokenModel;
  accountId: AccountIdModel;
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

  d.accountId.setAccountId(null);
  d.sessionToken.setSessionToken(null);
  await SQLite.deleteDatabaseAsync(MAIN_SQLITE_DB_NAME).catch(() => {});
  await writeLastLocalAccountId(d.secure, null);
}
