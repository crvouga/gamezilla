import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';

import { entityStoreSchema } from './tables';

/** Bring `entity_store` in line on SQLite without dropping undeclared tables. */
export async function reconcileEntityStoreSqlite(
  client: SqlClient
): Promise<void> {
  await reconcileSqliteSchema(client, entityStoreSchema, {
    ownership: 'declared-only',
  });
}
