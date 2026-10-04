import { Database } from 'bun:sqlite';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';

import type { LocalDomainSchema } from '@pkgs/sync-engine-client/local-schema-migrate';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared/tables';
import { createSerialSqlClient } from './serial-sql';

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
  await reconcileSqliteSchema(sqlClient, syncEngineServerSchema, {
    ownership: 'declared-only',
  });
  await reconcileSqliteSchema(sqlClient, domain.domainSchema, {
    ownership: 'declared-only',
  });
  return {
    sqlClient,
    close: async () => {
      await sqlClient.disconnect();
    },
  };
}
