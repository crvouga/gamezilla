// @sql-vendor-ok — transaction-scoped schema reconciliation lock.
import { appSchema } from '@libs/runtime/root/app-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import { reconcileEntityStorePostgres } from '@pkgs/entity-store/reconcile-postgres';
import { reconcileKvPostgres } from '@pkgs/kv-postgres/reconcile-postgres';
import type { Logger } from '@pkgs/logger';
import { reconcileOutboxPostgres } from '@pkgs/outbox';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { reconcileSyncEnginePostgres } from '@pkgs/sync-engine/shared';

export type DeclaredSchemaDeps = {
  readonly sqlClient: SqlClient;
  readonly dbScope: PostgresDbScope;
  readonly logger: Logger;
  readonly skipAdvisoryLock?: boolean;
  readonly skipIndexReconcile?: boolean;
};

/** Serializes table reconciliation; distinct from the matchmaking lock. */
const POSTGRES_RECONCILE_ADVISORY_LOCK_ID = '872014001234567890';

type SchemaPass = {
  readonly sqlClient: SqlClient;
  readonly dbScope: PostgresDbScope;
  readonly logger: Logger;
  readonly alreadyInTransaction: boolean;
  readonly indexPhase: 'inline' | 'skip' | 'only';
};

async function reconcileDeclaredSchemas(pass: SchemaPass): Promise<void> {
  const options = {
    dbScope: pass.dbScope,
    skipAdvisoryLock: true as const,
    alreadyInTransaction: pass.alreadyInTransaction,
    indexPhase: pass.indexPhase,
    skipStorageOptimizations: true,
  };
  pass.logger.info('reconciling sync-engine schema');
  await reconcileSyncEnginePostgres(pass.sqlClient, options);
  pass.logger.info('reconciling outbox schema');
  await reconcileOutboxPostgres(pass.sqlClient, options);
  pass.logger.info('reconciling domain schema');
  await reconcilePostgresSchema(pass.sqlClient, appSchema, pass.dbScope, {
    skipAdvisoryLock: true,
    alreadyInTransaction: pass.alreadyInTransaction,
    indexPhase: pass.indexPhase,
  });
  pass.logger.info('domain schema reconciled');
  await reconcileKvPostgres(pass.sqlClient, pass.logger, options);
  await reconcileEntityStorePostgres(pass.sqlClient, options);
}

async function reconcileSchemas(deps: DeclaredSchemaDeps): Promise<void> {
  const indexPhase = deps.skipIndexReconcile ? 'inline' : 'skip';
  const pass = {
    dbScope: deps.dbScope,
    logger: deps.logger,
    indexPhase,
  } as const;
  if (deps.skipAdvisoryLock) {
    await reconcileDeclaredSchemas({
      ...pass,
      sqlClient: deps.sqlClient,
      alreadyInTransaction: false,
    });
    return;
  }
  await deps.sqlClient.transaction(async (tx) => {
    await tx.run(raw("SET LOCAL lock_timeout = '0'"));
    deps.logger.info('acquiring reconcile advisory lock');
    await tx.run(
      sql<void>`SELECT pg_advisory_xact_lock(${POSTGRES_RECONCILE_ADVISORY_LOCK_ID}::bigint) AS locked`
    );
    deps.logger.info('reconcile advisory lock acquired');
    await tx.run(raw("SET LOCAL lock_timeout = '5min'"));
    await reconcileDeclaredSchemas({
      ...pass,
      sqlClient: tx,
      alreadyInTransaction: true,
    });
  });
}

async function reconcileDeclaredIndexes(
  deps: DeclaredSchemaDeps
): Promise<void> {
  if (deps.skipIndexReconcile) return;
  // The table pass defers indexes for every schema, including the framework
  // uniqueness constraints used by ON CONFLICT in outbox deliveries.
  await reconcileDeclaredSchemas({
    sqlClient: deps.sqlClient,
    dbScope: deps.dbScope,
    logger: deps.logger,
    alreadyInTransaction: false,
    indexPhase: 'only',
  });
  deps.logger.info('declared schema indexes reconciled');
}

/** Finish every deferred framework and domain index before serving writes. */
export async function reconcileDeclaredPostgresSchemas(
  deps: DeclaredSchemaDeps
): Promise<void> {
  await reconcileSchemas(deps);
  await reconcileDeclaredIndexes(deps);
}
