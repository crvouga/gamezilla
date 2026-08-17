/**
 * Portable SQLite migrate for product UI sims / in-process playground.
 * Composes package-owned migrations — no inline DDL.
 */

import { appSchema } from '@libs/db/shared/app-schema';
import { migrateNotifications } from '@libs/notifications/server/migrate';
import { runBetterAuthMigrations } from '@pkgs/auth-better-auth/server';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { EntityStoreSqliteDatabaseMigration } from '@pkgs/entity-store/sqlite-database-migration';
import type { Io } from '@pkgs/io';
import { KvSqliteDatabaseMigration } from '@pkgs/kv/sqlite-database-migration';
import { createLogger } from '@pkgs/logger';
import { migrateOutbox } from '@pkgs/outbox';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';

/** Fixed sim Better Auth secret (32+ chars — Better Auth requires length). */
export const SIM_BETTER_AUTH_SECRET = 'sim-better-auth-secret-0123456789abcdef';
/** Placeholder auth origin used during migrate (no network is used). */
export const SIM_API_URL = 'http://sim.local';
/** Placeholder DATABASE_URL for secret-store / config (SQLite has no TCP listener). */
export const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';

/** Applies portable framework + domain + kv/entity/notifications/outbox + Better Auth (sqlite). */
export async function migrateSimSqlite(args: {
  readonly sqlClient: SqlClient;
  readonly io: Io;
}): Promise<void> {
  const logger = createLogger({
    name: 'sim:migrate',
    level: 'silent',
    now: args.io.clock.now,
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
    baseURL: SIM_API_URL,
  });

  await migrateNotifications(args.sqlClient);
}
