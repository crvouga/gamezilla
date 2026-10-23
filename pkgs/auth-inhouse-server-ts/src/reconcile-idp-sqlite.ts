import { idpSchema } from '@pkgs/auth-inhouse-shared-ts/tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

/** Bring IdP tables in line on SQLite without dropping undeclared tables. */
export async function reconcileIdpSqlite(client: SqlClient): Promise<void> {
  await reconcileSqliteSchema(client, idpSchema, {
    ownership: 'declared-only',
  });
}
