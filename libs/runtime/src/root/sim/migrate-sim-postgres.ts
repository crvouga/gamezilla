/**
 * Postgres migrate for product UI sims / in-process product-simulator server DB.
 * Uses {@link PostgresMigrationRunner} with advisory-lock + PL/pgSQL compat
 * skipped (postgres-mem has no PL/pgSQL; JSON1 shims install at SqlClient open).
 */

import { appPostgresDbScope } from '@libs/db/public/scope';
import { createLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client-postgres/pg-types';
import { PostgresMigrationRunner } from '../../server/run-postgres-migrations';

/**
 * Where this file lives, repo-relative.
 *
 * The sim seed fingerprint hashes this module's source so a migration change
 * invalidates a stale dump. It reads it off disk by path, so the path lives
 * next to the file it names rather than in the reader — moving the file
 * without this broke every sim that boots from a seed, and only at test time.
 */
export const SIM_MIGRATE_SOURCE_DIR = 'libs/runtime/src/root/sim';

/** Placeholder DATABASE_URL for secret-store / config (no TCP listener). */
export const SIM_POSTGRES_MEM_DATABASE_URL = 'postgresql://postgres-mem/sim';

export {
  SIM_AUTH_SECRET,
  SIM_SERVER_URL,
} from '@libs/feature/public/sim-constants';

/** Applies framework + domain + kv/entity/outbox + IdP (Postgres dialect). */
export async function migrateSimPostgres(args: {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
  readonly now: () => number;
}): Promise<void> {
  const logger = createLogger({
    name: 'sim:migrate-postgres',
    level: 'silent',
    now: args.now,
  });
  const dbScope = appPostgresDbScope();
  await new PostgresMigrationRunner({
    sqlClient: args.sqlClient,
    logger,
    dbScope,
    skipAdvisoryLock: true,
    skipSqliteCompat: true,
  }).run();
  // Call sites keep `pool` for connection lifecycle; IdP migrate uses SqlClient only.
  void args.pool;
}
