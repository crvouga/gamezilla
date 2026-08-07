import type { SqlClient } from '@pkgs/sql-client/interface';
import { planClient } from '../core/plan';
import type { Schema } from '../core/types';
import { readSqliteCatalog } from './catalog';
import { emitClientOperation } from './emit';

export type SqliteOwnership = 'whole-db' | 'declared-only';

export type SqliteDriverOptions = {
  /**
   * `whole-db` (default): drop undeclared tables — the bound DB is wholly owned.
   * `declared-only`: leave undeclared tables alone (coexist with framework tables).
   */
  readonly ownership?: SqliteOwnership;
};

export type SqliteDriver = {
  reconcile(): Promise<void>;
};

/**
 * SQLite schema reconciler.
 *
 * Default `ownership: 'whole-db'`: the bound database is wholly owned —
 * unknown tables/columns are dropped; type-mismatched columns trigger a
 * rebuild. Non-managed `_`-prefixed columns are preserved through rebuilds.
 *
 * `ownership: 'declared-only'`: undeclared tables are invisible (like Postgres).
 * Use this when the same SQLite file also holds sync-engine framework tables.
 */
export function sqlite(
  schema: Schema,
  client: SqlClient,
  options?: SqliteDriverOptions
): SqliteDriver {
  const ownership = options?.ownership ?? 'whole-db';
  return {
    async reconcile(): Promise<void> {
      const declared = schema._declared;
      // Do not wrap in `client.transaction()`: SQLite auto-commits DDL
      // (CREATE/ALTER/DROP), which fights expo-sqlite web's BEGIN/COMMIT and
      // surfaces as "Error finalizing statement" on OPFS.
      const catalog = await readSqliteCatalog(client, declared);
      const ops = planClient(declared, catalog, { ownership });
      for (const op of ops) {
        for (const stmt of emitClientOperation(op, declared)) {
          await client.run(stmt);
        }
      }
    },
  };
}
