/**
 * In-process Postgres for `@pkgs/db-schema` integration tests (no Docker).
 * Uses postgres-mem with pinned `dbScope` / `search_path`.
 */

import { raw } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import {
  createPostgresDbScope,
  quotePgIdent,
} from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client-postgres/impl-postgres-mem';

export type PostgresMemTestClientBundle = {
  readonly sqlClient: PostgresSqlClient;
  close(): Promise<void>;
};

export async function createPostgresMemTestClient(
  schema = 'app_schema'
): Promise<PostgresMemTestClientBundle> {
  const dbScope = createPostgresDbScope(schema);
  const base = SqlClientImplPostgresMem.open({
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
