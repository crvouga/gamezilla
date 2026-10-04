import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { Context } from 'hono';

/** Request-scoped SQL set by API middleware — preferred over ALS `getSql`. */
export type SyncSqlVariables = {
  sqlClient: SqlClient;
};

/**
 * Prefer Hono `c.get('sqlClient')` (pinned on the request context before any
 * ALS await) over `getSql()` (ALS), which can race under stack ALS when
 * concurrent Worker requests overlap.
 */
export function resolveRequestSql(
  c: Context<{ Variables: SyncSqlVariables }>,
  getSql: () => SqlClient
): SqlClient {
  const fromContext = c.get('sqlClient') as SqlClient | undefined;
  if (fromContext !== undefined) return fromContext;
  return getSql();
}
