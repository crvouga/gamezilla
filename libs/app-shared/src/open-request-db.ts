import type { Pool } from '@pkgs/sql-client-postgres-shared/pg-types';
import type {
  PostgresSqlClient,
  SqlClient,
} from '@pkgs/sql-client-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';

export type RequestDbPostgres = {
  readonly kind: 'postgres';
  readonly sqlClient: PostgresSqlClient;
  readonly pool: Pool;
};

export type RequestDbSqlite = {
  readonly kind: 'sqlite';
  readonly sqlClient: SqlClient;
  /**
   * Optional native SQLite handle for auth adapters that need it.
   * Prefer `sqlClient` for domain work. Typed as `unknown` so this module
   * stays isomorphic (no `better-sqlite3` import).
   */
  readonly sqlite?: unknown;
};

export type RequestDb = RequestDbPostgres | RequestDbSqlite;

/** Opens a per-request DB handle. Composition roots inject Postgres / harness openers. */
export type OpenRequestDb = (
  connectionString: string,
  dbScope: PostgresDbScope
) => Promise<RequestDb>;
