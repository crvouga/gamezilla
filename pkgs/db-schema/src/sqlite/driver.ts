import { raw } from '@pkgs/sql';
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

function schemaHasForeignKeys(schema: Schema): boolean {
  for (const cols of Object.values(schema._declared.tables)) {
    for (const col of Object.values(cols)) {
      if (col.references !== undefined) return true;
    }
  }
  return false;
}

/**
 * SQLite schema reconciler.
 *
 * Extra columns without a deprecation entry fail (same safety as Postgres).
 * Deprecated columns may be dropped via rebuild. Undeclared tables are dropped
 * only under `ownership: 'whole-db'`.
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
      if (schemaHasForeignKeys(schema)) {
        await client.run(raw(`PRAGMA foreign_keys = ON`));
      }
      // Do not wrap in `client.transaction()`: SQLite auto-commits DDL
      // (CREATE/ALTER/DROP), which fights expo-sqlite web's BEGIN/COMMIT and
      // surfaces as "Error finalizing statement" on OPFS.
      const catalog = await readSqliteCatalog(client, declared);
      const plan = planClient(declared, catalog, { ownership });
      if (!plan.ok) {
        const detail = plan.drift
          .map((d) => `${d.path}: ${d.message}`)
          .join('\n');
        throw new Error(`db-schema sqlite reconcile drift:\n${detail}`);
      }
      for (const op of plan.operations) {
        for (const stmt of emitClientOperation(op, declared)) {
          await client.run(stmt);
        }
      }
    },
  };
}
