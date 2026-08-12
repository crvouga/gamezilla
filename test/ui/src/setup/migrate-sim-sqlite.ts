/**
 * Portable SQLite migrate for product UI sims (replaces pg-mem Postgres graph).
 * Composes package-owned migrations — no inline DDL.
 */

import { appSchema } from '@libs/db/shared/app-schema';
import { runBetterAuthMigrations } from '@pkgs/auth-better-auth/server';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { EntityStoreSqliteDatabaseMigration } from '@pkgs/entity-store/sqlite-database-migration';
import { migrateInbox } from '@pkgs/inbox/server/migrate';
import type { Io } from '@pkgs/io';
import { KvSqliteDatabaseMigration } from '@pkgs/kv/sqlite-database-migration';
import { createLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

/** Fixed sim Better Auth secret (32+ chars — Better Auth requires length). */
export const SIM_BETTER_AUTH_SECRET = 'sim-better-auth-secret-0123456789abcdef';
/** Placeholder auth origin used during migrate (no network is used). */
export const SIM_API_URL = 'http://sim.local';

/** Applies portable framework + domain + kv/entity/inbox + Better Auth (sqlite). */
export async function migrateSimSqlite(args: {
  readonly sqlClient: SqlClient;
  readonly sqlite: BetterSqliteDatabase;
  readonly io: Io;
}): Promise<void> {
  const logger = createLogger({
    name: 'sim:migrate',
    level: 'silent',
    now: args.io.clock.now,
  });
  const ctx = { sqlClient: args.sqlClient, logger };

  await new SyncEngineDatabaseMigration().migrate(ctx);
  await new SqliteSchemaDatabaseMigration(appSchema, {
    ownership: 'declared-only',
  }).migrate(ctx);
  await new KvSqliteDatabaseMigration().migrate(ctx);
  await new EntityStoreSqliteDatabaseMigration().migrate(ctx);

  await runBetterAuthMigrations({
    database: { kind: 'sqlite', db: args.sqlite },
    secret: SIM_BETTER_AUTH_SECRET,
    baseURL: SIM_API_URL,
  });

  await migrateInbox(args.sqlClient);
}
