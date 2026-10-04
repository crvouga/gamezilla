import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';

import { syncEngineServerSchema } from './tables';

export type ReconcileSyncEnginePostgresOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
  readonly indexPhase?: ReconcilePostgresSchemaOptions['indexPhase'];
};

/** Bring sync-engine server tables in line with their declared schema. */
export async function reconcileSyncEnginePostgres(
  client: SqlClient,
  options?: ReconcileSyncEnginePostgresOptions
): Promise<void> {
  const dbScope = options?.dbScope ?? createPostgresDbScope('public');
  await reconcilePostgresSchema(client, syncEngineServerSchema, dbScope, {
    skipAdvisoryLock: options?.skipAdvisoryLock ?? true,
    alreadyInTransaction: options?.alreadyInTransaction ?? true,
    ...(options?.indexPhase !== undefined
      ? { indexPhase: options.indexPhase }
      : {}),
  });
}
