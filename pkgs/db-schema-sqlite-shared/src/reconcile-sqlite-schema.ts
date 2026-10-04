import type { Schema } from '@pkgs/db-schema-shared/types';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { SqliteOwnership } from './driver';
import { sqlite } from './driver';

export type ReconcileSqliteSchemaOptions = {
  /**
   * `declared-only` (default): leave undeclared tables alone.
   * `whole-db`: drop undeclared tables.
   */
  readonly ownership?: SqliteOwnership;
};

/**
 * Bring SQLite in line with a {@link Schema}. Undeclared columns are kept.
 * Tombstoned columns are dropped by a row-preserving rebuild.
 */
export async function reconcileSqliteSchema(
  client: SqlClient,
  schema: Schema,
  options?: ReconcileSqliteSchemaOptions
): Promise<void> {
  await sqlite(schema, client, options).reconcile();
}
