/**
 * Portable SQLite migrate for product UI sims (replaces pg-mem Postgres graph).
 */

import { appSchema } from '@libs/db/shared/app-schema';
import { runBetterAuthMigrations } from '@pkgs/auth-better-auth/server';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { migrateInbox } from '@pkgs/inbox/server/migrate';
import type { Io } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import { raw } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

/** Fixed sim Better Auth secret (32+ chars — Better Auth requires length). */
export const SIM_BETTER_AUTH_SECRET = 'sim-better-auth-secret-0123456789abcdef';
/** Placeholder auth origin used during migrate (no network is used). */
export const SIM_API_URL = 'http://sim.local';

const KV_DDL = `
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  last_modified_at TEXT NOT NULL
)
`.trim();

const ENTITY_STORE_DDL = `
CREATE TABLE IF NOT EXISTS entity_store (
  id text NOT NULL PRIMARY KEY,
  namespace text NOT NULL,
  type text NOT NULL,
  external_id text NOT NULL,
  owner_id text,
  data text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  UNIQUE (namespace, type, external_id)
)
`.trim();

const ENTITY_STORE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS entity_store_namespace_owner_idx ON entity_store (namespace, owner_id)',
  'CREATE INDEX IF NOT EXISTS entity_store_namespace_type_idx ON entity_store (namespace, type)',
] as const;

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

  await new SyncEngineDatabaseMigration().migrate({
    sqlClient: args.sqlClient,
    logger,
  });
  await new SqliteSchemaDatabaseMigration(appSchema, {
    ownership: 'declared-only',
  }).migrate({ sqlClient: args.sqlClient, logger });

  await args.sqlClient.run(raw(KV_DDL));
  await args.sqlClient.run(raw(ENTITY_STORE_DDL));
  for (const stmt of ENTITY_STORE_INDEXES) {
    await args.sqlClient.run(raw(stmt));
  }

  await runBetterAuthMigrations({
    database: { kind: 'sqlite', db: args.sqlite },
    secret: SIM_BETTER_AUTH_SECRET,
    baseURL: SIM_API_URL,
  });

  await migrateInbox(args.sqlClient);
}
