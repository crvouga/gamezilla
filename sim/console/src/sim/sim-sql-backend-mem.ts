/**
 * Mem fabric: postgres-mem server + sqlite-mem clients.
 * Only imported from {@link getSimSqlEngines}.
 */

import type { Clock } from '@pkgs/clock';
import type { SimCheckpointSqlFormat } from '@pkgs/sim-console/shared/sim-checkpoint';
import {
  adaptPostgresMemAsPool,
  SqlClientImplPostgresMem,
} from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { openSimPostgresMemFromSeed } from '@pkgs/sql-client/postgres/open-sim-postgres-mem-from-seed';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';
import { nextSimSqlDatabaseName, type SimSql } from './sim-sql-types';

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
  return { client, pool: adaptPostgresMemAsPool(() => client.rawDb) };
}

export function openMemClientSql(logicalName: string, clock: Clock): SimSql {
  let databaseName = nextSimSqlDatabaseName(logicalName);
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
      databaseName = nextSimSqlDatabaseName(logicalName);
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

export function openMemServerSql(logicalName: string, clock: Clock): SimSql {
  let databaseName = nextSimSqlDatabaseName(logicalName);
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
      databaseName = nextSimSqlDatabaseName(logicalName);
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

export async function openMemServerSqlFromSeed(
  logicalName: string,
  clock: Clock,
  seedBytes: Uint8Array
): Promise<SimSql> {
  let databaseName = nextSimSqlDatabaseName(logicalName);
  let live = openSimPostgresMemFromSeed({ seedBytes, clock });
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
      live = openSimPostgresMemFromSeed({ seedBytes, clock });
      await live.sqlClient.connect();
      await prev.disconnect();
    },
    exportBytes: async () => live.exportBytes(),
    importBytes: async (bytes) => {
      live.importBytes(bytes);
    },
  };
}

export const MEM_CHECKPOINT_SQL_FORMAT: SimCheckpointSqlFormat =
  'mixed-pgmm-sqlm';
