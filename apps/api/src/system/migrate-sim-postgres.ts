/**
 * Portable Postgres migrate for in-process playground (pg-mem).
 * Uses {@link PostgresMigrationRunner} with pg-mem-safe flags:
 * `skipAdvisoryLock` + `skipSqliteCompat` (JSON1 via installPgMemSqliteCompat).
 */

import { PostgresMigrationRunner } from '@libs/db/server/run-postgres-migrations';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import type { Io } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';

import { SIM_API_URL, SIM_BETTER_AUTH_SECRET } from './migrate-sim-sqlite';

/** Placeholder DATABASE_URL for secret-store / config (pg-mem has no TCP listener). */
export const SIM_PG_MEM_DATABASE_URL = 'postgres://pg-mem/sim';

export {
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
} from './migrate-sim-sqlite';

/** Applies framework + domain + kv/entity + Better Auth on pg-mem Postgres. */
export async function migrateSimPostgres(args: {
  readonly sqlClient: PostgresSqlClient;
  readonly pool: Pool;
  readonly io: Io;
}): Promise<void> {
  const logger = createLogger({
    name: 'sim:migrate-postgres',
    level: 'silent',
    now: args.io.clock.now,
  });
  await new PostgresMigrationRunner({
    sqlClient: args.sqlClient,
    pool: args.pool,
    logger,
    dbScope: appPostgresDbScope(),
    betterAuthBaseURL: SIM_API_URL,
    betterAuthSecret: SIM_BETTER_AUTH_SECRET,
    skipAdvisoryLock: true,
    skipSqliteCompat: true,
  }).run();
}
