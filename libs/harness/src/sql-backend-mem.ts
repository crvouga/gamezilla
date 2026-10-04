/**
 * Mem fabric: mockingbird-postgres server + mockingbird-sqlite clients.
 * Only imported from {@link getHarnessSqlEngines}.
 */

import type { Clock } from '@pkgs/clock-shared/types';
import type { HarnessCheckpointSqlFormat } from '@pkgs/harness-console-shared/checkpoint';
import {
  adaptMockingbirdPostgresAsPool,
  SqlClientImplMockingbirdPostgres,
} from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import type { Pool } from '@pkgs/sql-client-postgres-shared/pg-types';
import { openHarnessMockingbirdPostgresFromSeed } from '@pkgs/sql-client-root-harness/open-harness-mockingbird-postgres-from-seed';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import type { HarnessSql } from './sql-types';
import { nextHarnessSqlDatabaseName } from './sql-types';

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

export function openMemClientSql(
  logicalName: string,
  clock: Clock
): HarnessSql {
  let databaseName = nextHarnessSqlDatabaseName(logicalName);
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
      databaseName = nextHarnessSqlDatabaseName(logicalName);
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

export function openMemServerSql(
  logicalName: string,
  clock: Clock
): HarnessSql {
  let databaseName = nextHarnessSqlDatabaseName(logicalName);
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
      databaseName = nextHarnessSqlDatabaseName(logicalName);
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
): Promise<HarnessSql> {
  let databaseName = nextHarnessSqlDatabaseName(logicalName);
  let live = openHarnessMockingbirdPostgresFromSeed({ seedBytes, clock });
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
      databaseName = nextHarnessSqlDatabaseName(logicalName);
      live = openHarnessMockingbirdPostgresFromSeed({ seedBytes, clock });
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

export const MEM_CHECKPOINT_SQL_FORMAT: HarnessCheckpointSqlFormat =
  'mixed-pgmm-sqlm';
