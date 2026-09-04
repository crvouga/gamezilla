/**
 * Web real fabric: PGlite server + SQLite WASM clients.
 * Loaded by Metro instead of {@link ./sim-sql-backend-real.ts} on platform web
 * so Node engines (better-sqlite3 / bun:sqlite / PGlite worker) never enter the
 * Hermes classic-script bundle.
 */

import type { Clock } from '@pkgs/clock';
import type { SimCheckpointSqlFormat } from '@pkgs/sim-console/shared/sim-checkpoint';
import {
  openPgliteSqlClient,
  type PgliteSqlBundle,
} from '@pkgs/sql-client-postgres/impl-pglite';
import { openSimPgliteFromSeed } from '@pkgs/sql-client-sim/boot-sim-pglite';
import { nextSimSqlDatabaseName, type SimSql } from './sim-sql-types';

export const REAL_CHECKPOINT_SQL_FORMAT: SimCheckpointSqlFormat =
  'mixed-pglite-sqlite';

async function openBrowserSqliteClient(bytes?: Uint8Array): Promise<{
  readonly client: import('@pkgs/sql-client-sqlite/impl-sqlite-wasm').SqlClientImplSqliteWasm;
  exportBytes(): Uint8Array;
  importBytes(bytes: Uint8Array): void;
  disconnect(): Promise<void>;
}> {
  const { SqlClientImplSqliteWasm } = await import(
    '@pkgs/sql-client-sqlite/impl-sqlite-wasm'
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
  clock: Clock
): Promise<SimSql> {
  void clock;
  let databaseName = nextSimSqlDatabaseName(logicalName);
  let live = await openBrowserSqliteClient();
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
      live = await openBrowserSqliteClient();
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
): Promise<SimSql> {
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
): Promise<SimSql> {
  void clock;
  return wrapPgliteBundle(logicalName, () => openPgliteSqlClient());
}

export async function openRealServerSqlFromSeed(
  logicalName: string,
  clock: Clock,
  seedBytes: Uint8Array
): Promise<SimSql> {
  return wrapPgliteBundle(logicalName, () =>
    openSimPgliteFromSeed({ seedBytes, clock })
  );
}
