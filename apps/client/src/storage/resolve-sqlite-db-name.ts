import { assertDatabaseName } from '@pkgs/sql';

/** Short stable id fragment for SQLite filenames (keeps names near legacy length). */
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 12);
}

/**
 * Resolves the local SQLite database name for a `users.id`.
 *
 * - Always `user_<shortUserId>` (anon and signed-in share one naming scheme)
 * - Web: append `_<shortTabId>` so OPFS tabs do not contend
 */
export function resolveSqliteDbName(args: {
  readonly userId: string;
  readonly webTabSuffix?: string;
}): string {
  const base = `user_${shortId(args.userId)}`;
  const name =
    args.webTabSuffix !== undefined && args.webTabSuffix.length > 0
      ? `${base}_${shortId(args.webTabSuffix)}`
      : base;
  assertDatabaseName(name);
  return name;
}
