import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { entityStoreSchema } from './schema/tables';

/** Bring `entity_store` in line on SQLite without dropping undeclared tables. */
export async function reconcileEntityStoreSqlite(
  client: SqlClient
): Promise<void> {
  await reconcileSqliteSchema(client, entityStoreSchema, {
    ownership: 'declared-only',
  });
}
