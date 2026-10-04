/**
 * In-process Postgres for `@pkgs/db-schema` integration tests (no Docker).
 * Uses mockingbird-postgres with pinned `dbScope` / `search_path`.
 */

import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import type {
  PostgresSqlClient,
  SqlClient,
} from '@pkgs/sql-client-root-shared/interface';
import {
  createPostgresDbScope,
  quotePgIdent,
} from '@pkgs/sql-client-root-shared/postgres-db-scope';
import { raw } from '@pkgs/sql-root-shared/sql';

export type MockingbirdPostgresTestClientBundle = {
  readonly sqlClient: PostgresSqlClient;
  close(): Promise<void>;
};

export async function createMockingbirdPostgresTestClient(
  schema = 'app_schema'
): Promise<MockingbirdPostgresTestClientBundle> {
  const dbScope = createPostgresDbScope(schema);
  const base = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    dbScope,
    installSqliteCompat: false,
  });
  await base.connect();
  const quoted = quotePgIdent(dbScope.schema);

  await base.run(raw(`CREATE SCHEMA IF NOT EXISTS ${quoted}`));
  await base.run(raw(`SET search_path TO ${quoted}`));

  const sqlClient: PostgresSqlClient = {
    dbScope,
    connect: () => base.connect(),
    disconnect: () => base.disconnect(),
    query: (q) => base.query(q),
    run: (q) => base.run(q),
    prepare: (q) => base.prepare(q),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) => base.transaction(fn),
  };

  return {
    sqlClient,
    close: () => base.disconnect(),
  };
}
