import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';

import { outboxSchema } from './tables';

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
