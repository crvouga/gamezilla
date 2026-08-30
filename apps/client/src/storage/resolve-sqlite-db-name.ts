import { assertDatabaseName } from '@pkgs/sql';

/** Short stable id fragment for SQLite filenames (keeps names near legacy length). */
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 12);
}

/**
 * Resolves the local SQLite database name for a `users.id`.
 *
 * Always `user_<shortUserId>` (anon and signed-in share one naming scheme).
 * Web tabs share that name; OPFS exclusivity is handled by the sql-client broker.
 */
export function resolveSqliteDbName(args: { readonly userId: string }): string {
  const name = `user_${shortId(args.userId)}`;
  assertDatabaseName(name);
  return name;
}
