import { Database } from 'bun:sqlite';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { createLogger } from '@pkgs/logger';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import {
  SYNC_ENGINE_MUTATIONS_APPLIED,
  SYNC_ENGINE_TOPIC_SEQ,
  SYNC_ENGINE_WRITE_REJECTIONS,
} from '../shared/framework-server-ddl';
import { createSerialSqlClient } from './serial-sql';

/** Silent migrate logger — level silent; `now` unused but required by createLogger. */
const domainMigrateLogger = createLogger({
  name: 'open-sim-sqlite',
  level: 'silent',
  now: () => 0,
});

/**
 * Server framework tables needed by mutation replay + pushSeq allocation.
 * SQLite dialect for the sim (production uses Postgres FRAMEWORK_SERVER_DDL).
 */
export const FRAMEWORK_SIM_SERVER_DDL = `
CREATE TABLE IF NOT EXISTS ${SYNC_ENGINE_MUTATIONS_APPLIED} (
  mutation_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'rejected')),
  applied_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_engine_mutations_applied_client_id_seq_idx
  ON ${SYNC_ENGINE_MUTATIONS_APPLIED} (client_id, seq);
CREATE TABLE IF NOT EXISTS ${SYNC_ENGINE_WRITE_REJECTIONS} (
  id TEXT PRIMARY KEY,
  mutation_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sync_engine_write_rejections_client_id_idx
  ON ${SYNC_ENGINE_WRITE_REJECTIONS} (client_id);
CREATE INDEX IF NOT EXISTS sync_engine_write_rejections_mutation_id_idx
  ON ${SYNC_ENGINE_WRITE_REJECTIONS} (mutation_id);
CREATE TABLE IF NOT EXISTS ${SYNC_ENGINE_TOPIC_SEQ} (
  topic TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
`;

export type SimSqliteBundle = {
  readonly sqlClient: SqlClient;
  close(): Promise<void>;
};

async function applyDdl(db: SqlClient, ddl: string): Promise<void> {
  const statements = ddl
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.run(unsafe(stmt));
  }
}

/**
 * In-memory Bun SQLite for the sim server (same engine as clients).
 */
export async function openSimSqliteServer(
  domain: LocalDomainSchema
): Promise<SimSqliteBundle> {
  const raw = new Database(':memory:');
  const base = new SqlClientImplBunSqlite(raw);
  await base.connect();
  const sqlClient = createSerialSqlClient(base);
  await applyDdl(sqlClient, FRAMEWORK_SIM_SERVER_DDL);
  await new SqliteSchemaDatabaseMigration(domain.domainSchema, {
    ownership: 'declared-only',
  }).migrate({ sqlClient, logger: domainMigrateLogger });
  return {
    sqlClient,
    close: async () => {
      await sqlClient.disconnect();
    },
  };
}
