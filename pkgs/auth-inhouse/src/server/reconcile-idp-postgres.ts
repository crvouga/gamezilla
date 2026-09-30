import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  createPostgresDbScope,
  type PostgresDbScope,
} from '@pkgs/sql-client/postgres-db-scope';

import { idpSchema } from '../shared/schema/tables';

export type ReconcileIdpPostgresOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
  readonly indexPhase?: ReconcilePostgresSchemaOptions['indexPhase'];
};

/** Bring IdP tables in line on Postgres. */
export async function reconcileIdpPostgres(
  client: SqlClient,
  options?: ReconcileIdpPostgresOptions
): Promise<void> {
  const dbScope = options?.dbScope ?? createPostgresDbScope('public');
  await reconcilePostgresSchema(client, idpSchema, dbScope, {
    skipAdvisoryLock: options?.skipAdvisoryLock ?? true,
    alreadyInTransaction: options?.alreadyInTransaction ?? false,
    ...(options?.indexPhase !== undefined
      ? { indexPhase: options.indexPhase }
      : {}),
  });
}
