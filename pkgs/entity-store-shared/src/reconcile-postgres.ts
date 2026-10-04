import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';

import { entityStoreSchema } from './tables';

export type ReconcileEntityStorePostgresOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
  readonly indexPhase?: ReconcilePostgresSchemaOptions['indexPhase'];
};

/** Bring `entity_store` in line on Postgres. */
export async function reconcileEntityStorePostgres(
  client: SqlClient,
  options?: ReconcileEntityStorePostgresOptions
): Promise<void> {
  const dbScope = options?.dbScope ?? createPostgresDbScope('public');
  await reconcilePostgresSchema(client, entityStoreSchema, dbScope, {
    skipAdvisoryLock: options?.skipAdvisoryLock ?? true,
    alreadyInTransaction: options?.alreadyInTransaction ?? true,
    ...(options?.indexPhase !== undefined
      ? { indexPhase: options.indexPhase }
      : {}),
  });
}
