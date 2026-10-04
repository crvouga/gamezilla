/**
 * Local SQLite database naming. Kept apart from `./open-main-sql-client` so
 * the boot path can name databases without loading the web SQLite client.
 */

import { assertDatabaseName } from '@pkgs/sql-shared/assert-database-name';

/** Short stable id fragment for SQLite filenames (keeps names near legacy length). */
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 12);
}

/**
 * Resolves the local SQLite database name for a `users.id`. Always
 * `user_<shortUserId>` (anon and signed-in share one naming scheme). Tabs
 * share that name; OPFS exclusivity is handled by the sql-client broker.
 */
export function resolveSqliteDbName(args: { readonly userId: string }): string {
  const name = `user_${shortId(args.userId)}`;
  assertDatabaseName(name);
  return name;
}

/** Database name for this app instance from the bound `users.id`. */
export function getMainSqliteDbName(userId: string | null): string {
  if (userId === null || userId.length === 0) {
    const fallback = 'user_pending';
    assertDatabaseName(fallback);
    return fallback;
  }
  return resolveSqliteDbName({ userId });
}
