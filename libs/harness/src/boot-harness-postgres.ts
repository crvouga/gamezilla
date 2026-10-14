/**
 * Live Mockingbird Postgres handle for mode-real DST (migrated by the stack boot).
 */
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-local-shared/ports';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';

export type HarnessPostgresHandle = {
  readonly pool: ReturnType<typeof createPgPool>['pool'];
  readonly sqlClient: SqlClient;
  readonly databaseUrl: string;
  stop(): Promise<void>;
};

/** `databaseUrl` defaults to the shared local cluster; a stack passes its own. */
export function bootHarnessPostgres(
  databaseUrl: string = LOCAL_DATABASE_URL
): Promise<HarnessPostgresHandle> {
  const dbScope = appPostgresDbScope();
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope,
    max: 4,
  });
  return Promise.resolve({
    pool,
    sqlClient,
    databaseUrl,
    async stop() {
      await pool.end();
    },
  });
}
