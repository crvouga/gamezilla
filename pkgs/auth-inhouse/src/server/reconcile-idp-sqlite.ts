import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { idpSchema } from '../shared/schema/tables';

/** Bring IdP tables in line on SQLite without dropping undeclared tables. */
export async function reconcileIdpSqlite(client: SqlClient): Promise<void> {
  await reconcileSqliteSchema(client, idpSchema, {
    ownership: 'declared-only',
  });
}
