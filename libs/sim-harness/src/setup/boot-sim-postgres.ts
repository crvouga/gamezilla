/**
 * Live embedded Postgres handle for mode-real DST (migrated by the stack boot).
 */
import { appPostgresDbScope } from '@libs/db/public/scope';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded/ports';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';

export type SimPostgresHandle = {
  readonly sqlClient: SqlClient;
  readonly databaseUrl: string;
  stop(): Promise<void>;
};

/** `databaseUrl` defaults to the shared local cluster; a stack passes its own. */
export function bootSimPostgres(
  databaseUrl: string = LOCAL_DATABASE_URL
): Promise<SimPostgresHandle> {
  const dbScope = appPostgresDbScope();
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope,
    max: 4,
  });
  return Promise.resolve({
    sqlClient,
    databaseUrl,
    async stop() {
      await pool.end();
    },
  });
}
