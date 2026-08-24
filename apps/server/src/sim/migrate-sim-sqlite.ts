/**
 * Portable SQLite migrate for product UI sims / in-process playground.
 * Composes package-owned migrations — no inline DDL.
 */

import { appSchema } from '@libs/runtime/root/app-schema';
import { runBetterAuthMigrations } from '@pkgs/auth-better-auth/server';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { EntityStoreSqliteDatabaseMigration } from '@pkgs/entity-store/sqlite-database-migration';
import { KvSqliteDatabaseMigration } from '@pkgs/kv/sqlite-database-migration';
import { createLogger } from '@pkgs/logger';
import { migrateOutbox } from '@pkgs/outbox';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';
import { SIM_BETTER_AUTH_SECRET, SIM_SERVER_URL } from './sim-constants';

export {
  SIM_BETTER_AUTH_SECRET,
  SIM_SERVER_URL,
  SIM_SQLITE_DATABASE_URL,
} from './sim-constants';

/** Applies portable framework + domain + kv/entity/outbox + Better Auth (sqlite). */
export async function migrateSimSqlite(args: {
  readonly sqlClient: SqlClient;
  readonly now: () => number;
}): Promise<void> {
  const logger = createLogger({
    name: 'sim:migrate',
    level: 'silent',
    now: args.now,
  });
  const ctx = { sqlClient: args.sqlClient, logger };

  await new SyncEngineDatabaseMigration().migrate(ctx);
  await migrateOutbox(args.sqlClient);
  await new SqliteSchemaDatabaseMigration(appSchema, {
    ownership: 'declared-only',
  }).migrate(ctx);
  await new KvSqliteDatabaseMigration().migrate(ctx);
  await new EntityStoreSqliteDatabaseMigration().migrate(ctx);

  await runBetterAuthMigrations({
    database: { kind: 'sql-client', client: args.sqlClient },
    secret: SIM_BETTER_AUTH_SECRET,
    baseURL: SIM_SERVER_URL,
  });
}
