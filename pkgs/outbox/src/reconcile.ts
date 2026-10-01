import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres-db-scope';

import { outboxSchema } from './schema/tables';

/** Bring the outbox schema in line on SQLite (client / harness). */
export async function reconcileOutbox(sqlClient: SqlClient): Promise<void> {
  await reconcileSqliteSchema(sqlClient, outboxSchema, {
    ownership: 'declared-only',
  });
}

export type ReconcileOutboxPostgresOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
  readonly indexPhase?: ReconcilePostgresSchemaOptions['indexPhase'];
};

/** Bring the outbox schema in line on Postgres. */
export async function reconcileOutboxPostgres(
  client: SqlClient,
  options?: ReconcileOutboxPostgresOptions
): Promise<void> {
  const dbScope = options?.dbScope ?? createPostgresDbScope('public');
  await reconcilePostgresSchema(client, outboxSchema, dbScope, {
    skipAdvisoryLock: options?.skipAdvisoryLock ?? true,
    alreadyInTransaction: options?.alreadyInTransaction ?? true,
    ...(options?.indexPhase !== undefined
      ? { indexPhase: options.indexPhase }
      : {}),
  });
}
