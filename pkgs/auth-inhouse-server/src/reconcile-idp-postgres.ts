import { idpSchema } from '@pkgs/auth-inhouse-shared/tables';
import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';

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
