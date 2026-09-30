import type { Schema } from '@pkgs/db-schema/core/types';
import { createNoopLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import {
  PostgresSchemaDatabaseMigration,
  type PostgresSchemaDatabaseMigrationOptions,
} from './postgres-schema-database-migration';

export type ReconcilePostgresSchemaOptions =
  PostgresSchemaDatabaseMigrationOptions;

/**
 * Apply a {@link Schema} to Postgres. Uses the migration class so legacy
 * wall DEFAULT cleanup on managed columns still runs.
 */
export async function reconcilePostgresSchema(
  client: SqlClient,
  schema: Schema,
  dbScope: PostgresDbScope,
  options?: ReconcilePostgresSchemaOptions
): Promise<void> {
  await new PostgresSchemaDatabaseMigration(schema, dbScope, options).migrate({
    sqlClient: client,
    logger: createNoopLogger(),
  });
}
