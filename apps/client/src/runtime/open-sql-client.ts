/**
 * Local SQLite for patch-db: per-account (or anonymous-by-device-id) file
 * via expo-sqlite. Same code path on web and native — `account-db.ts`
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
} from '@gamezilla/auth/client/account-db';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

export type OpenSqlClientRuntimeDeps = {
  getAccountId: () => string | null;
  /** Local device UUID from secure storage (`createDeviceService`). */
  getDeviceId: () => string;
};

/**
 * Per-account file DB when signed in; otherwise an anonymous file keyed by
 * the local device UUID (stable across cold starts of the same install).
 * Identical resolution on web and native.
 */
export async function openSqlClientForPlatform(
  deps: OpenSqlClientRuntimeDeps
): Promise<SqlClient> {
  const accountId = deps.getAccountId();
  if (accountId !== null) {
    return openAccountDb(accountId);
  }
  return openAnonymousDb(deps.getDeviceId());
}
