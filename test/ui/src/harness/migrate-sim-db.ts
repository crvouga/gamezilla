/**
 * Runs the full Postgres migration graph against an in-process pg-mem database.
 *
 * Mirrors `apps/api` migrate but with fixed sim Better Auth boot values and
 * `skipAdvisoryLock` (pg-mem cannot nest SET LOCAL + DO-block DDL).
 */

import { PostgresMigrationRunner } from '@libs/db/server/run-postgres-migrations';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import type { Io } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';

/** Fixed sim Better Auth secret (32+ chars — Better Auth requires length). */
export const SIM_BETTER_AUTH_SECRET = 'sim-better-auth-secret-0123456789abcdef';
/** Placeholder auth origin used during migrate (no network is used). */
export const SIM_API_URL = 'http://sim.local';

/** Applies every registered migration to the shared pg-mem client/pool. */
export async function migrateSimDb(args: {
  readonly sqlClient: PostgresSqlClient;
  readonly pool: Pool;
  readonly io: Io;
}): Promise<void> {
  const dbScope = appPostgresDbScope();
  const logger = createLogger({
    name: 'sim:migrate',
    level: 'silent',
    now: args.io.clock.now,
  });
  await new PostgresMigrationRunner({
    sqlClient: args.sqlClient,
    pool: args.pool,
    logger,
    dbScope,
    betterAuthSecret: SIM_BETTER_AUTH_SECRET,
    betterAuthBaseURL: SIM_API_URL,
    skipAdvisoryLock: true,
  }).run();
}
