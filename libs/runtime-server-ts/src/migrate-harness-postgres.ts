/**
 * Postgres reconcile for product UI harnesses / in-process product-harness server DB.
 * Skips the advisory lock and PL/pgSQL compat (mockingbird-postgres has no PL/pgSQL;
 * JSON1 shims install at SqlClient open).
 */

import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import type { Pool } from '@pkgs/sql-client-postgres-shared-ts/pg-types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { reconcilePostgres } from './reconcile-postgres';

/**
 * Where this file lives, repo-relative.
 *
 * The harness seed fingerprint hashes this module's source so a reconcile change
 * invalidates a stale dump. It reads it off disk by path, so the path lives
 * next to the file it names rather than in the reader — moving the file
 * without this broke every harness that boots from a seed, and only at test time.
 */
export const HARNESS_MIGRATE_SOURCE_DIR = 'libs/runtime-server-ts/src';

/** Placeholder DATABASE_URL for secret-store / config (no TCP listener). */
export const HARNESS_MOCKINGBIRD_POSTGRES_DATABASE_URL =
  'postgresql://mockingbird-postgres/harness';

/** Applies framework + domain + kv/entity/outbox + IdP (Postgres dialect). */
export async function migrateHarnessPostgres(args: {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
  readonly now: () => number;
}): Promise<void> {
  const logger = createLogger({
    name: 'harness:migrate-postgres',
    level: 'silent',
    now: args.now,
  });
  const dbScope = appPostgresDbScope();
  await reconcilePostgres({
    sqlClient: args.sqlClient,
    logger,
    dbScope,
    skipAdvisoryLock: true,
    skipSqliteCompat: true,
  });
  // Call sites keep `pool` for connection lifecycle; IdP reconcile uses SqlClient only.
  void args.pool;
}
