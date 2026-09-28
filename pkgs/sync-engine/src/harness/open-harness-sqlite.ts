import { Database } from 'bun:sqlite';
import {
  applySqliteSchema,
  SqliteSchemaDatabaseMigration,
} from '@pkgs/db-schema-sqlite';
import { createLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import { syncEngineServerSchema } from '../shared/schema/tables';
import { createSerialSqlClient } from './serial-sql';

/** Silent migrate logger — level silent; `now` unused but required by createLogger. */
const domainMigrateLogger = createLogger({
  name: 'open-harness-sqlite',
  level: 'silent',
  now: () => 0,
});

export type HarnessSqliteBundle = {
  readonly sqlClient: SqlClient;
  close(): Promise<void>;
};

/**
 * In-memory Bun SQLite for the harness server (same defineTable schema as prod).
 */
export async function openHarnessSqliteServer(
  domain: LocalDomainSchema
): Promise<HarnessSqliteBundle> {
  const raw = new Database(':memory:');
  const base = new SqlClientImplBunSqlite(raw);
  await base.connect();
  const sqlClient = createSerialSqlClient(base);
  await applySqliteSchema(sqlClient, syncEngineServerSchema, {
    ownership: 'declared-only',
  });
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
