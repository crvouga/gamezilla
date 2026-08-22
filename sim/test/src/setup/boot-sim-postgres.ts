/**
 * Live embedded Postgres handle for fidelity-max DST (migrated by the stack boot).
 */
import { appPostgresDbScope } from '@libs/db/public/scope';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded/ports';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';

export type SimPostgresHandle = {
  readonly sqlClient: SqlClient;
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
    databaseUrl: LOCAL_DATABASE_URL,
    async stop() {
      await pool.end();
    },
  };
}
