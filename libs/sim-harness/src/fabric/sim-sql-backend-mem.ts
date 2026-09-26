/**
 * Mem fabric: mockingbird-postgres server + mockingbird-sqlite clients.
 * Only imported from {@link getSimSqlEngines}.
 */

import type { Clock } from '@pkgs/clock';
import type { SimCheckpointSqlFormat } from '@pkgs/sim-console/shared/sim-checkpoint';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import {
  adaptMockingbirdPostgresAsPool,
  SqlClientImplMockingbirdPostgres,
} from '@pkgs/sql-client-postgres/impl-mockingbird-postgres';
import type { Pool } from '@pkgs/sql-client-postgres/pg-types';
import { openSimMockingbirdPostgresFromSeed } from '@pkgs/sql-client-sim/open-sim-mockingbird-postgres-from-seed';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import { nextSimSqlDatabaseName, type SimSql } from './sim-sql-types';

function openMockingbirdSqlite(clock: Clock): SqlClientImplMockingbirdSqlite {
  return SqlClientImplMockingbirdSqlite.open({
    seed: 1,
    now: () => new Date(clock.now()),
  });
}

function openMockingbirdPostgres(clock: Clock): {
  client: SqlClientImplMockingbirdPostgres;
  pool: Pool;
} {
  const client = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    now: () => new Date(clock.now()),
    dbScope: createPostgresDbScope('public'),
  });
  return { client, pool: adaptMockingbirdPostgresAsPool(() => client.rawDb) };
}

export function openMemClientSql(logicalName: string, clock: Clock): SimSql {
  let databaseName = nextSimSqlDatabaseName(logicalName);
  let live = openMockingbirdSqlite(clock);
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
      databaseName = nextSimSqlDatabaseName(logicalName);
      live = openMockingbirdSqlite(clock);
      await live.connect();
      await prev.disconnect();
    },
    exportBytes: () => Promise.resolve(live.exportDatabaseBytes()),
    importBytes: (bytes) => {
      live.importDatabaseBytes(bytes);
      return Promise.resolve();
    },
  };
}

export function openMemServerSql(logicalName: string, clock: Clock): SimSql {
  let databaseName = nextSimSqlDatabaseName(logicalName);
  let live = openMockingbirdPostgres(clock);
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
      databaseName = nextSimSqlDatabaseName(logicalName);
      live = openMockingbirdPostgres(clock);
      await live.client.connect();
      await prev.client.disconnect();
    },
    exportBytes: () => Promise.resolve(live.client.exportDatabaseBytes()),
    importBytes: (bytes) => {
      live.client.importDatabaseBytes(bytes);
      return Promise.resolve();
    },
  };
}

export async function openMemServerSqlFromSeed(
  logicalName: string,
  clock: Clock,
  seedBytes: Uint8Array
): Promise<SimSql> {
  let databaseName = nextSimSqlDatabaseName(logicalName);
  let live = openSimMockingbirdPostgresFromSeed({ seedBytes, clock });
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
      live = openSimMockingbirdPostgresFromSeed({ seedBytes, clock });
      await live.sqlClient.connect();
      await prev.disconnect();
    },
    exportBytes: () => Promise.resolve(live.exportBytes()),
    importBytes: (bytes) => {
      live.importBytes(bytes);
      return Promise.resolve();
    },
  };
}

export const MEM_CHECKPOINT_SQL_FORMAT: SimCheckpointSqlFormat =
  'mixed-pgmm-sqlm';
