import type { Schema } from '@pkgs/db-schema/core/types';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { type SqliteOwnership, sqlite } from './driver';

export type ApplySqliteSchemaOptions = {
  /**
   * `declared-only` (default): leave undeclared tables alone.
   * `whole-db`: drop undeclared tables.
   */
  readonly ownership?: SqliteOwnership;
};

/**
 * Apply a {@link Schema} to SQLite without a {@link DatabaseMigration} wrapper.
 * Prefer this in tests and local migrate paths that already hold a client.
 */
export async function applySqliteSchema(
  client: SqlClient,
  schema: Schema,
  options?: ApplySqliteSchemaOptions
): Promise<void> {
  await sqlite(schema, client, options).reconcile();
}
