/**
 * Live embedded Postgres handle for fidelity-max DST (migrated by the stack boot).
 */
import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { openRequestDb } from '@apps/api/db/open-request-db-postgres';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';

export type SimPostgresHandle = {
  readonly sqlClient: SqlClient;
  readonly openRequestDb: OpenRequestDb;
  readonly databaseUrl: string;
  stop(): Promise<void>;
};

export async function bootSimPostgres(): Promise<SimPostgresHandle> {
  const dbScope = appPostgresDbScope();
  const { pool, sqlClient } = createPgPool({
    connectionString: LOCAL_DATABASE_URL,
    dbScope,
    max: 4,
  });
  return {
    sqlClient,
    openRequestDb,
    databaseUrl: LOCAL_DATABASE_URL,
    async stop() {
      await pool.end();
    },
  };
}
