/**
 * Local SQLite for patch-db: per-account (or anonymous-by-server-clientId)
 * file via expo-sqlite. Same code path on web and native — `account-db.ts`
 * passes `dir = undefined` on web, which is the expo-sqlite OPFS path with
 * the recovery logic in `SqlClientImplExpoSqlite.open` (open → fail →
 * `deleteDatabaseAsync` retry → fail → OPFS wipe + reload). Multi-tab on web
 * is best-effort: the recovery flow handles common contention but can still
 * surface a "close other tabs" error in pathological cases.
 *
 * Takes explicit getters so this module does not import {@link ./atoms}
 * (avoids cycles).
 *
 * @module @gamezilla/client/runtime/open-sql-client
 */

import {
  openAccountDb,
  openAnonymousDb,
} from '@gamezilla/client/db/account-db';
import { ensureServerClientId } from '@gamezilla/client/db/ensure-server-client-id';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

export type OpenSqlClientRuntimeDeps = {
  getAccountId: () => string | null;
  getSecureStorage: () => SecureStorage;
  getApiUrl: () => string;
};

/**
 * Per-account file DB when signed in; otherwise an anonymous file keyed by
 * the server-issued `clientId` (stable across cold starts of the same
 * device). Identical resolution on web and native.
 */
export async function openSqlClientForPlatform(
  deps: OpenSqlClientRuntimeDeps
): Promise<SqlClient> {
  const accountId = deps.getAccountId();
  if (accountId !== null) {
    return openAccountDb(accountId);
  }
  const clientId = await ensureServerClientId(
    deps.getApiUrl(),
    deps.getSecureStorage()
  );
  return openAnonymousDb(clientId);
}
