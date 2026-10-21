import type { ReconcilePostgresSchemaOptions } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { kvSchema } from '@pkgs/kv-root-shared-ts/tables';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';

import { applyKvStorageOptimizations } from './postgres-storage-knobs';

export type ReconcileKvPostgresOptions = {
  readonly dbScope?: PostgresDbScope;
  readonly skipAdvisoryLock?: boolean;
  readonly alreadyInTransaction?: boolean;
  readonly skipStorageOptimizations?: boolean;
  readonly indexPhase?: ReconcilePostgresSchemaOptions['indexPhase'];
};

/** Bring `kv` in line, then apply UNLOGGED / fillfactor storage knobs. */
export async function reconcileKvPostgres(
  client: SqlClient,
  logger: Logger,
  options?: ReconcileKvPostgresOptions
): Promise<void> {
  const dbScope = options?.dbScope ?? createPostgresDbScope('public');
  const log = logger.child({ reconcile: 'kv-postgres' });
  log.info('kv postgres reconcile: start');
  await reconcilePostgresSchema(client, kvSchema, dbScope, {
    skipAdvisoryLock: options?.skipAdvisoryLock ?? true,
    alreadyInTransaction: options?.alreadyInTransaction ?? true,
    ...(options?.indexPhase !== undefined
      ? { indexPhase: options.indexPhase }
      : {}),
  });
  if (!options?.skipStorageOptimizations) {
    await applyKvStorageOptimizations(client, log, {
      alreadyInTransaction: options?.alreadyInTransaction ?? false,
    });
  }
  log.info('kv postgres reconcile: complete');
}
