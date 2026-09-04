/**
 * Postgres migrate for product UI sims / in-process playground server DB.
 * Uses {@link PostgresMigrationRunner} with advisory-lock + PL/pgSQL compat
 * skipped (postgres-mem has no PL/pgSQL; JSON1 shims install at SqlClient open).
 */

import { appPostgresDbScope } from '@libs/db/public/scope';
import { PostgresMigrationRunner } from '@libs/runtime/server/run-postgres-migrations';
import { createLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client-postgres/pg-types';

/** Placeholder DATABASE_URL for secret-store / config (no TCP listener). */
export const SIM_POSTGRES_MEM_DATABASE_URL = 'postgresql://postgres-mem/sim';

export {
  SIM_AUTH_SECRET,
  SIM_SERVER_URL,
} from './sim-constants';

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
