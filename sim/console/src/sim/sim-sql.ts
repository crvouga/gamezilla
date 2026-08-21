import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  adaptPostgresMemAsPool,
  SqlClientImplPostgresMem,
} from '@pkgs/sql-client/postgres/impl-postgres-mem';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

export type SimSqlHandle = {
  readonly sqlClient: SqlClient;
  readonly databaseName: string;
  /** Present for postgres-mem server handles (Better Auth migrate). */
  readonly pool?: Pool;
  disconnect(): Promise<void>;
  reset(): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  importBytes(bytes: Uint8Array): Promise<void>;
};

let simSqlSeq = 0;

function uniqueName(base: string): string {
  simSqlSeq += 1;
  const safe = base.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${safe}_${simSqlSeq}`;
}

function openSqliteMem(clock: Clock): SqlClientImplSqliteMem {
  return SqlClientImplSqliteMem.open({
    seed: 1,
    now: () => new Date(clock.now()),
  });
}

function openPostgresMem(clock: Clock): {
  client: SqlClientImplPostgresMem;
  pool: Pool;
} {
  const client = SqlClientImplPostgresMem.open({
    seed: 1,
    now: () => new Date(clock.now()),
    dbScope: createPostgresDbScope('public'),
  });
  return { client, pool: adaptPostgresMemAsPool(client.rawDb) };
}

/** Client / actor SQLite handle (sqlite-mem). */
export function openSimSqlHandle(
  logicalName: string,
  clock: Clock
): SimSqlHandle {
  let databaseName = uniqueName(logicalName);
  let live = openSqliteMem(clock);
  return {
    get sqlClient() {
      return live;
    },
    get databaseName() {
      return databaseName;
    },
    disconnect: () => live.disconnect(),
    reset: async () => {
      const prev = live;
      databaseName = uniqueName(logicalName);
      live = openSqliteMem(clock);
      await live.connect();
      await prev.disconnect();
    },
    exportBytes: async () => live.exportDatabaseBytes(),
    importBytes: async (bytes) => {
      live.importDatabaseBytes(bytes);
    },
  };
}

/** Server Postgres handle (postgres-mem). */
export function openSimServerSqlHandle(
  logicalName: string,
  clock: Clock
): SimSqlHandle {
  let databaseName = uniqueName(logicalName);
  let live = openPostgresMem(clock);
  return {
    get sqlClient() {
      return live.client;
    },
    get databaseName() {
      return databaseName;
    },
    get pool() {
      return live.pool;
    },
    disconnect: () => live.client.disconnect(),
    reset: async () => {
      const prev = live;
      databaseName = uniqueName(logicalName);
      live = openPostgresMem(clock);
      await live.client.connect();
      await prev.client.disconnect();
    },
    exportBytes: async () => live.client.exportDatabaseBytes(),
    importBytes: async (bytes) => {
      live.client.importDatabaseBytes(bytes);
    },
  };
}

/** @deprecated Prefer {@link openFreshSimClientSql} — alias for client sqlite-mem. */
export async function openFreshSimSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  return openFreshSimClientSql(logicalName, clock);
}

export async function openFreshSimClientSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  const handle = openSimSqlHandle(logicalName, clock);
  await handle.sqlClient.connect();
  return handle;
}

export async function openFreshSimServerSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  const handle = openSimServerSqlHandle(logicalName, clock);
  await handle.sqlClient.connect();
  return handle;
}

/** Ignore request-middleware disconnect on shared process-lifetime DBs. */
export function sharedSqlClient(sqlClient: SqlClient): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => sqlClient.query(query),
    run: (query) => sqlClient.run(query),
    prepare: (query) => sqlClient.prepare(query),
    transaction: (fn) => sqlClient.transaction(fn),
  };
}

export function handleBoundSqlClient(handle: SimSqlHandle): SqlClient {
  return sharedSqlClient({
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => handle.sqlClient.query(query),
    run: (query) => handle.sqlClient.run(query),
    prepare: (query) => handle.sqlClient.prepare(query),
    transaction: (fn) => handle.sqlClient.transaction(fn),
  });
}
