import type { Schema } from '@pkgs/db-schema-root-shared/types';
import type {
  PostgresSqlClient,
  SqlClient,
} from '@pkgs/sql-client-root-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';
import type { PostgresDriverOptions } from './driver';
import { postgres } from './driver';

export type ReconcilePostgresSchemaOptions = PostgresDriverOptions;

/**
 * Bring Postgres in line with a {@link Schema}: create tables, add columns,
 * backfill, drop non-PK `NOT NULL`, widen `int2`/`int4` integers to `bigint`,
 * drop engine defaults on managed columns, and reconcile package indexes.
 * Never drops a table or column, renames, or changes any other type.
 */
export async function reconcilePostgresSchema(
  client: SqlClient,
  schema: Schema,
  dbScope: PostgresDbScope,
  options?: ReconcilePostgresSchemaOptions
): Promise<void> {
  const postgresClient = Object.assign(client, {
    dbScope,
  }) as PostgresSqlClient;
  await postgres(schema, postgresClient, {
    ...options,
    indexPhase: options?.indexPhase ?? 'inline',
  }).reconcile();
}
