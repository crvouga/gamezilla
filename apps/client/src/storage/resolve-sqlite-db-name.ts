import { assertDatabaseName } from '@pkgs/sql';

/** Short stable id fragment for SQLite filenames (keeps names near legacy length). */
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 12);
}

/**
 * Resolves the local SQLite database name for an auth identity.
 *
 * - Signed in: `acct_<shortAccountId>`
 * - Signed out: `anon_<shortDeviceId>`
 * - Web: append `_<shortTabId>` so OPFS tabs do not contend
 */
export function resolveSqliteDbName(args: {
  readonly accountId: string | null;
  readonly deviceId: string;
  readonly webTabSuffix?: string;
}): string {
  const base =
    args.accountId !== null
      ? `acct_${shortId(args.accountId)}`
      : `anon_${shortId(args.deviceId)}`;
  const name =
    args.webTabSuffix !== undefined && args.webTabSuffix.length > 0
      ? `${base}_${shortId(args.webTabSuffix)}`
      : base;
  assertDatabaseName(name);
  return name;
}
