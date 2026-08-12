import { Database } from 'bun:sqlite';
import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { createLogger } from '@pkgs/logger';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import { FRAMEWORK_SERVER_DDL } from '../shared/framework-server-ddl';
import { createSerialSqlClient } from './serial-sql';

/** Silent migrate logger — level silent; `now` unused but required by createLogger. */
const domainMigrateLogger = createLogger({
  name: 'open-sim-sqlite',
  level: 'silent',
  now: () => 0,
});

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
 * In-memory Bun SQLite for the sim server (same portable framework DDL as prod).
 */
export async function openSimSqliteServer(
  domain: LocalDomainSchema
): Promise<SimSqliteBundle> {
  const raw = new Database(':memory:');
  const base = new SqlClientImplBunSqlite(raw);
  await base.connect();
  const sqlClient = createSerialSqlClient(base);
  await applyDdl(sqlClient, FRAMEWORK_SERVER_DDL);
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
