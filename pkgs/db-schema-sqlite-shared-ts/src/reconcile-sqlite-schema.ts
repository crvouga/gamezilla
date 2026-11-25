import type { Schema } from '@pkgs/db-schema-root-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
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
  const driver = sqlite(schema, client, options);
  try {
    await driver.reconcile();
  } catch (error) {
    // A cache wipe can remove a declared table after catalog discovery.
    // Replan from the surviving rows without wiping the database again.
    const missing =
      error instanceof Error
        ? /no such table: main\.([a-z_][a-z0-9_]*)$/i.exec(error.message)?.[1]
        : undefined;
    if (
      missing === undefined ||
      !Object.hasOwn(schema._declared.tables, missing)
    )
      throw error;
    await driver.reconcile();
  }
}
