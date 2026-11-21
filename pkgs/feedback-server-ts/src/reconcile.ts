import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { feedbackSchema } from './tables';

export type ReconcileFeedbackPostgresOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
  readonly indexPhase?: ReconcilePostgresSchemaOptions['indexPhase'];
};

/** Bring the bug report queue (`feedback_bug_reports`) in line on Postgres. */
export async function reconcileFeedbackPostgres(
  client: SqlClient,
  options?: ReconcileFeedbackPostgresOptions
): Promise<void> {
  const dbScope = options?.dbScope ?? createPostgresDbScope('public');
  await reconcilePostgresSchema(client, feedbackSchema, dbScope, {
    skipAdvisoryLock: options?.skipAdvisoryLock ?? true,
    alreadyInTransaction: options?.alreadyInTransaction ?? false,
    ...(options?.indexPhase !== undefined
      ? { indexPhase: options.indexPhase }
      : {}),
  });
}
