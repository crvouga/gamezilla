/**
 * Browser local SQLite: multi-tab-safe OPFS broker from
 * `@pkgs/sql-client-sqlite-web`. Local sync schema migration runs after open.
 */

import type { Timers } from '@pkgs/clock';
import { assertDatabaseName } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createWebSqlClient } from '@pkgs/sql-client-sqlite-web';

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

export async function openMainSqlClient(
  userId: string,
  timers: Timers
): Promise<SqlClient> {
  const { VITE_E2E } = import.meta.env;
  const client = createWebSqlClient(getMainSqliteDbName(userId), {
    timers,
    ...(VITE_E2E === '1'
      ? { sqliteWorkerUrl: '/sql-workers/sqlite-worker.js?memory=1' }
      : {}),
  });
  await client.connect();
  return client;
}
