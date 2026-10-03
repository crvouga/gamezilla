import { APP_QUERIES } from '@libs/runtime/root/app-queries';
import { APP_AUTH_PROVIDER } from '@libs/runtime/root/server/app-auth-provider';
import type { Clock } from '@pkgs/clock';
import { MIGRATE_RECONCILE_CONFIG, resolveConfig } from '@pkgs/db-indexes';
import { createPostgresPort } from '@pkgs/db-indexes-postgres';
import { applyKvStorageOptimizations } from '@pkgs/kv-postgres/postgres-storage-knobs';
import type { Logger } from '@pkgs/logger';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { ensurePostgresSchema } from '@pkgs/sql-client-postgres/ensure-schema';
import { extractWorkload } from '@pkgs/sync-engine/shared';

import { grantObsRead } from './grant-obs-read';
import { reconcileDeclaredPostgresSchemas } from './reconcile-declared-schemas';
import { runMigrateIndexReconcile } from './run-migrate-index-reconcile';

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
  const skipIndexReconcile =
    deps.skipIndexReconcile ?? deps.skipAdvisoryLock ?? false;
  const resolved = { ...deps, skipIndexReconcile };
  await ensurePostgresSchema(resolved.sqlClient, resolved.dbScope);
  if (!resolved.skipSqliteCompat) {
    await installPostgresSqliteCompat({ sqlClient: resolved.sqlClient });
  }
  await reconcileDeclaredPostgresSchemas(resolved);
  await applyKvStorageOptimizations(resolved.sqlClient, resolved.logger, {
    allowTemporarilyUnavailableTable: true,
  });
  await APP_AUTH_PROVIDER.reconcilePostgres?.({
    sqlClient: resolved.sqlClient,
    dbScope: resolved.dbScope,
  });
  await grantObsRead(resolved.sqlClient, resolved.logger);
  await reconcileWorkloadIndexes(resolved);
}
