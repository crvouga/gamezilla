import { PGlite } from '@electric-sql/pglite';
import { raw } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import {
  createPostgresDbScope,
  quotePgIdent,
} from '@pkgs/sql-client/postgres/schema';

export type SimPostgresBundle = {
  readonly sqlClient: PostgresSqlClient;
  close(): Promise<void>;
};

/**
 * In-process PGlite for the sim server — supports framework PL/pgSQL DDL
 * and `@pkgs/db-schema` postgres reconcile (unlike pg-mem).
 */
export async function openSimPostgres(
  schema = 'public'
): Promise<SimPostgresBundle> {
  const db = await PGlite.create();
  const base = createPgliteSqlClient(db);
  const dbScope = createPostgresDbScope(schema);
  const quoted = quotePgIdent(dbScope.schema);

  if (schema !== 'public') {
    await base.run(raw(`CREATE SCHEMA IF NOT EXISTS ${quoted}`));
  }
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
    close: async () => {
      await db.close();
    },
  };
}
