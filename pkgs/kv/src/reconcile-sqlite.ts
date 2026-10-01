import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { kvSchema } from './schema/tables';

/** Bring `kv` in line on SQLite without dropping undeclared tables. */
export async function reconcileKvSqlite(client: SqlClient): Promise<void> {
  await reconcileSqliteSchema(client, kvSchema, {
    ownership: 'declared-only',
  });
}
