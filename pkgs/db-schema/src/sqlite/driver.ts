import type { SqlClient } from '@pkgs/sql-client/interface';
import { planClient } from '../core/plan';
import type { Schema } from '../core/types';
import { readSqliteCatalog } from './catalog';
import { emitClientOperation } from './emit';

export type SqliteDriver = {
  reconcile(): Promise<void>;
};

/**
 * SQLite schema reconciler. The database the injected client is bound to is
 * **wholly owned** by this package. Destructive convergence applies to the
 * entire database: unknown tables/columns are dropped; type-mismatched columns
 * trigger a table rebuild (local data in that table may be discarded).
 *
 * Non-managed `_`-prefixed columns are preserved through convergence
 * (including rebuilds). Any client-local, non-synced app data must live in a
 * **different** SQLite database with its own client.
 */
export function sqlite(schema: Schema, client: SqlClient): SqliteDriver {
  return {
    async reconcile(): Promise<void> {
      const declared = schema._declared;
      await client.transaction(async (tx) => {
        const catalog = await readSqliteCatalog(tx, declared);
        const ops = planClient(declared, catalog);
        for (const op of ops) {
          for (const stmt of emitClientOperation(op, declared)) {
            await tx.run(stmt);
          }
        }
      });
    },
  };
}
