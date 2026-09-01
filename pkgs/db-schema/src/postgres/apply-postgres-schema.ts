import { createNoopLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';

import type { Schema } from '../core/types';
import {
  PostgresSchemaDatabaseMigration,
  type PostgresSchemaDatabaseMigrationOptions,
} from './postgres-schema-database-migration';

export type ApplyPostgresSchemaOptions = PostgresSchemaDatabaseMigrationOptions;

/**
 * Apply a {@link Schema} to Postgres. Uses the migration class so legacy
 * wall DEFAULT cleanup on managed columns still runs.
 */
export async function applyPostgresSchema(
  client: SqlClient,
  schema: Schema,
  dbScope: PostgresDbScope,
  options?: ApplyPostgresSchemaOptions
): Promise<void> {
  await new PostgresSchemaDatabaseMigration(schema, dbScope, options).migrate({
    sqlClient: client,
    logger: createNoopLogger(),
  });
}
