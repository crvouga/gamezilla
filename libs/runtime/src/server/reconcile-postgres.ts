// @sql-vendor-ok — Postgres reconcile mutex uses pg_advisory_xact_lock / SET LOCAL.
import { APP_QUERIES } from '@libs/runtime/root/app-queries';
import { appSchema } from '@libs/runtime/root/app-schema';
import { APP_AUTH_PROVIDER } from '@libs/runtime/root/server/app-auth-provider';
import type { Clock } from '@pkgs/clock';
import { MIGRATE_RECONCILE_CONFIG, resolveConfig } from '@pkgs/db-indexes';
import { createPostgresPort } from '@pkgs/db-indexes-postgres';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import { reconcileEntityStorePostgres } from '@pkgs/entity-store/reconcile-postgres';
import { reconcileKvPostgres } from '@pkgs/kv-postgres/reconcile-postgres';
import type { Logger } from '@pkgs/logger';
import { reconcileOutboxPostgres } from '@pkgs/outbox';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { ensurePostgresSchema } from '@pkgs/sql-client-postgres/ensure-schema';
import { extractWorkload, reconcileSyncEnginePostgres } from '@pkgs/sync-engine/shared';

import { grantObsRead } from './grant-obs-read';
import { runMigrateIndexReconcile } from './run-migrate-index-reconcile';

/**
 * Session/transaction advisory lock for app reconcile. Serializes concurrent
 * reconciles (api + `@pkgs/postgres-embedded` boot, parallel CI jobs) so they
 * wait instead of thrashing on DDL `lock_timeout`. Distinct from the
 * matchmaking tick lock id.
 */
export const POSTGRES_RECONCILE_ADVISORY_LOCK_ID = '872014001234567890';

export type ReconcilePostgresDeps = {
  sqlClient: SqlClient;
  logger: Logger;
  dbScope: PostgresDbScope;
  /**
   * When true, skip `pg_advisory_xact_lock` + outer transaction (mockingbird-postgres /
   * single-process harnesses cannot nest SET LOCAL with DDL on one adapter pool).
   */
  skipAdvisoryLock?: boolean;
  /**
   * When true, skip PL/pgSQL sqlite-compat functions.
   * Use when JSON1 shims are installed at SqlClient open time (mockingbird-postgres).
   */
  skipSqliteCompat?: boolean;
  /**
   * When true, skip workload index reconcile.
   * Defaults to true when `skipAdvisoryLock` (harness / mockingbird-postgres).
   */
  skipIndexReconcile?: boolean;
  /** Injected clock for index reconcile deadlines (required unless skipped). */
  clock?: Clock;
};

type SchemaPass = {
  readonly sqlClient: SqlClient;
  readonly dbScope: PostgresDbScope;
  readonly logger: Logger;
  readonly alreadyInTransaction: boolean;
  readonly indexPhase: 'inline' | 'skip';
};

async function reconcileDeclaredSchemas(pass: SchemaPass): Promise<void> {
  const options = {
    dbScope: pass.dbScope,
    skipAdvisoryLock: true as const,
    alreadyInTransaction: pass.alreadyInTransaction,
    indexPhase: pass.indexPhase,
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

async function reconcileSchemas(deps: ReconcilePostgresDeps): Promise<void> {
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

async function reconcileDomainIndexes(
  deps: ReconcilePostgresDeps
): Promise<void> {
  if (deps.skipIndexReconcile) return;
  await reconcilePostgresSchema(deps.sqlClient, appSchema, deps.dbScope, {
    skipAdvisoryLock: true,
    alreadyInTransaction: false,
    indexPhase: 'only',
  });
  deps.logger.info('domain schema indexes reconciled');
}

async function reconcileWorkloadIndexes(
  deps: ReconcilePostgresDeps
): Promise<void> {
  if (deps.skipIndexReconcile) return;
  if (deps.clock === undefined) {
    throw new Error(
      'reconcilePostgres: clock required when index reconcile is enabled'
    );
  }
  const migrateConfig = resolveConfig(MIGRATE_RECONCILE_CONFIG);
  const manifest = await extractWorkload(APP_QUERIES);
  const db = createPostgresPort(deps.sqlClient, { clock: deps.clock });
  await runMigrateIndexReconcile({
    manifest,
    db,
    clock: deps.clock,
    logger: deps.logger,
    deadlineMs: migrateConfig.defaultDeadlineMs,
  });
}

/** Bring the application Postgres database in line with its declared schemas. */
export async function reconcilePostgres(
  deps: ReconcilePostgresDeps
): Promise<void> {
  const skipIndexReconcile = deps.skipIndexReconcile ?? deps.skipAdvisoryLock;
  const resolved = { ...deps, skipIndexReconcile };
  await ensurePostgresSchema(resolved.sqlClient, resolved.dbScope);
  if (!resolved.skipSqliteCompat) {
    await installPostgresSqliteCompat({ sqlClient: resolved.sqlClient });
  }
  await reconcileSchemas(resolved);
  await APP_AUTH_PROVIDER.reconcilePostgres?.({
    sqlClient: resolved.sqlClient,
    dbScope: resolved.dbScope,
  });
  await grantObsRead(resolved.sqlClient, resolved.logger);
  await reconcileDomainIndexes(resolved);
  await reconcileWorkloadIndexes(resolved);
}
