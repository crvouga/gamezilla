import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

import { kvSchema } from './tables';

/** Bring `kv` in line on SQLite without dropping undeclared tables. */
export async function reconcileKvSqlite(client: SqlClient): Promise<void> {
  await reconcileSqliteSchema(client, kvSchema, {
    ownership: 'declared-only',
  });
}
