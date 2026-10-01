import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres-db-scope';

import { entityStoreSchema } from './schema/tables';

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
