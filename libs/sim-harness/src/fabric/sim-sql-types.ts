import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client-postgres/pg-types';

/**
 * Opaque SQL handle for sim server / actor DBs.
 * Dump format is `mixed-pgmm-sqlm` (postgres-mem + sqlite-mem).
 */
export type SimSql = {
  readonly sqlClient: SqlClient;
  readonly databaseName: string;
  /** Present when Better Auth / Kysely migrate needs a `pg.Pool` facade. */
  readonly pool?: Pool;
  disconnect(): Promise<void>;
  reset(): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  importBytes(bytes: Uint8Array): Promise<void>;
};

let simSqlSeq = 0;

export function nextSimSqlDatabaseName(logicalName: string): string {
  simSqlSeq += 1;
  const safe = logicalName.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${safe}_${simSqlSeq}`;
}

/** Ignore request-middleware disconnect on shared process-lifetime DBs. */
export function sharedSqlClient(sqlClient: SqlClient): SqlClient {
  return {
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    query: (query) => sqlClient.query(query),
    run: (query) => sqlClient.run(query),
    prepare: (query) => sqlClient.prepare(query),
    transaction: (fn) => sqlClient.transaction(fn),
  };
}

export function handleBoundSqlClient(handle: SimSql): SqlClient {
  return sharedSqlClient({
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    query: (query) => handle.sqlClient.query(query),
    run: (query) => handle.sqlClient.run(query),
    prepare: (query) => handle.sqlClient.prepare(query),
    transaction: (fn) => handle.sqlClient.transaction(fn),
  });
}
