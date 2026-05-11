/**
 * Local SQLite for patch-db: per-account (or anonymous-by-device-id) file
 * via expo-sqlite. The actual open/recovery logic lives in
 * `@gamezilla/auth/client/account-db`; here we just delegate via injected
 * factories so this module stays a leaf.
 */
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { getRuntimeFactories } from '@gamezilla/auth/client/runtime-factories';

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
  const factories = getRuntimeFactories();
  const accountId = deps.getAccountId();
  if (accountId !== null) {
    return factories.openAccountDb(accountId);
  }
  return factories.openAnonymousDb(deps.getDeviceId());
}
