/**
 * Postgres reconcile for product UI harnesses / in-process product-harness server DB.
 * Skips the advisory lock and PL/pgSQL compat (mockingbird-postgres has no PL/pgSQL;
 * JSON1 shims install at SqlClient open).
 */

import { appPostgresDbScope } from '@libs/db/public/scope';
import { createLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client-postgres/pg-types';
import { reconcilePostgres } from '../../server/reconcile-postgres';

/**
 * Where this file lives, repo-relative.
 *
 * The harness seed fingerprint hashes this module's source so a reconcile change
 * invalidates a stale dump. It reads it off disk by path, so the path lives
 * next to the file it names rather than in the reader — moving the file
 * without this broke every harness that boots from a seed, and only at test time.
 */
export const HARNESS_MIGRATE_SOURCE_DIR = 'libs/runtime/src/root/harness';

/** Placeholder DATABASE_URL for secret-store / config (no TCP listener). */
export const HARNESS_MOCKINGBIRD_POSTGRES_DATABASE_URL =
  'postgresql://mockingbird-postgres/harness';

export {
  HARNESS_AUTH_SECRET,
  HARNESS_SERVER_URL,
} from '@libs/feature/public/harness-constants';

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
