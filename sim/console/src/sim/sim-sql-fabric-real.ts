/**
 * Real fabric: PGlite server + real SQLite clients.
 * Browser → SQLite WASM; Node → better-sqlite3 (Jest) / bun:sqlite when Bun.
 * Only imported from {@link getSimSqlFabric}.
 */

import type { Clock } from '@pkgs/clock';
import type { SimCheckpointSqlFormat } from '@pkgs/sim-console/shared/sim-checkpoint';
import { openSimPgliteFromSeed } from '@pkgs/sql-client/postgres/boot-sim-pglite';
import {
  openPgliteSqlClient,
  type PgliteSqlBundle,
} from '@pkgs/sql-client/postgres/impl-pglite';
import { SqlClientImplBetterSqlite } from '@pkgs/sql-client/sqlite/impl-better-sqlite3';
import { resolveSimSqlRuntime, type SimSqlRuntime } from './sim-sql-backend';
import { nextSimSqlDatabaseName, type SimSqlHandle } from './sim-sql-handle';

export const REAL_CHECKPOINT_SQL_FORMAT: SimCheckpointSqlFormat =
  'mixed-pglite-sqlite';

type NodeSqliteLive =
  | SqlClientImplBetterSqlite
  | Awaited<ReturnType<typeof openBunLive>>;

async function openBunLive(
  bytes?: Uint8Array
): Promise<
  import('@pkgs/sql-client/sqlite/impl-bun-sqlite').SqlClientImplBunSqlite
> {
  const { SqlClientImplBunSqlite } = await import(
    '@pkgs/sql-client/sqlite/impl-bun-sqlite'
  );
  return bytes !== undefined
    ? SqlClientImplBunSqlite.openFromBytes(bytes)
    : SqlClientImplBunSqlite.openMemory();
}

function preferBunSqlite(): boolean {
  // `bunx jest` still runs Jest on Node — only use bun:sqlite under Bun's runtime.
  return (
    typeof process !== 'undefined' &&
    typeof process.versions === 'object' &&
    process.versions !== null &&
    typeof (process.versions as { bun?: string }).bun === 'string'
  );
}

async function openNodeSqliteClient(bytes?: Uint8Array): Promise<{
  readonly client: NodeSqliteLive;
  exportBytes(): Uint8Array;
  importBytes(bytes: Uint8Array): void;
  disconnect(): Promise<void>;
}> {
  if (preferBunSqlite()) {
    const client = await openBunLive(bytes);
    return {
      client,
      exportBytes: () => client.serializeBytes(),
      importBytes: (b) => {
        client.importBytes(b);
      },
      disconnect: () => client.disconnect(),
    };
  }
  const client =
    bytes !== undefined
      ? SqlClientImplBetterSqlite.openFromBytes(bytes)
      : SqlClientImplBetterSqlite.openMemory();
  return {
    client,
    exportBytes: () => client.serializeBytes(),
    importBytes: (b) => {
      client.importBytes(b);
    },
    disconnect: () => client.disconnect(),
  };
}

async function openBrowserSqliteClient(bytes?: Uint8Array): Promise<{
  readonly client: import('@pkgs/sql-client/sqlite/impl-sqlite-wasm').SqlClientImplSqliteWasm;
  exportBytes(): Uint8Array;
  importBytes(bytes: Uint8Array): void;
  disconnect(): Promise<void>;
}> {
  const { SqlClientImplSqliteWasm } = await import(
    '@pkgs/sql-client/sqlite/impl-sqlite-wasm'
  );
  const client = await SqlClientImplSqliteWasm.open(bytes);
  return {
    client,
    exportBytes: () => client.exportDatabaseBytes(),
    importBytes: (b) => {
      client.importDatabaseBytes(b);
    },
    disconnect: () => client.disconnect(),
  };
}

export async function openRealClientSql(
  logicalName: string,
  clock: Clock,
  runtime: SimSqlRuntime = resolveSimSqlRuntime()
): Promise<SimSqlHandle> {
  void clock;
  let databaseName = nextSimSqlDatabaseName(logicalName);
  let live =
    runtime === 'browser'
      ? await openBrowserSqliteClient()
      : await openNodeSqliteClient();
  await live.client.connect();
  return {
    get sqlClient() {
      return live.client;
    },
    get databaseName() {
      return databaseName;
    },
    disconnect: () => live.disconnect(),
    reset: async () => {
      const prev = live;
      databaseName = nextSimSqlDatabaseName(logicalName);
      live =
        runtime === 'browser'
          ? await openBrowserSqliteClient()
          : await openNodeSqliteClient();
      await live.client.connect();
      await prev.disconnect();
    },
    exportBytes: async () => live.exportBytes(),
    importBytes: async (bytes) => {
      live.importBytes(bytes);
    },
  };
}

function wrapPgliteBundle(
  logicalName: string,
  openFresh: () => Promise<PgliteSqlBundle>
): Promise<SimSqlHandle> {
  return (async () => {
    let databaseName = nextSimSqlDatabaseName(logicalName);
    let live = await openFresh();
    await live.sqlClient.connect();
    return {
      get sqlClient() {
        return live.sqlClient;
      },
      get databaseName() {
        return databaseName;
      },
      get pool() {
        return live.pool;
      },
      disconnect: () => live.disconnect(),
      reset: async () => {
        const prev = live;
        databaseName = nextSimSqlDatabaseName(logicalName);
        live = await openFresh();
        await live.sqlClient.connect();
        await prev.disconnect();
      },
      exportBytes: () => live.exportBytes(),
      importBytes: (bytes) => live.replaceFromBytes(bytes),
    };
  })();
}

export async function openRealServerSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  void clock;
  return wrapPgliteBundle(logicalName, () => openPgliteSqlClient());
}

export async function openRealServerSqlFromSeed(
  logicalName: string,
  clock: Clock,
  seedBytes: Uint8Array
): Promise<SimSqlHandle> {
  return wrapPgliteBundle(logicalName, () =>
    openSimPgliteFromSeed({ seedBytes, clock })
  );
}
