/**
 * Portable logical SQL dump/load port — one implementation per dialect.
 */

import { getUnderlyingSqlClient } from './impl-agnostic';
import type { PostgresSqlClient, SqlClient } from './interface';
import {
  dumpPostgresData,
  listPostgresUserTables,
  loadPostgresData,
} from './postgres';
import { dumpSqliteData, listSqliteUserTables, loadSqliteData } from './sqlite';
import type { SqlDataDump, SqlDataDumpOptions } from './types';

/** Capability for portable table dump/load on any supported SqlClient. */
export type SqlDataSnapshotPort = {
  listUserTables(): Promise<readonly string[]>;
  dumpData(opts?: SqlDataDumpOptions): Promise<SqlDataDump>;
  loadData(dump: SqlDataDump): Promise<void>;
};

function isPostgresSqlClient(client: SqlClient): client is PostgresSqlClient {
  return 'dbScope' in client;
}

/** Bind portable dump/load to any SqlClient (unwraps agnostic decorators). */
export function bindSqlDataSnapshot(client: SqlClient): SqlDataSnapshotPort {
  const inner = getUnderlyingSqlClient(client);
  if (isPostgresSqlClient(inner)) {
    return {
      listUserTables: () => listPostgresUserTables(inner),
      dumpData: (opts) => dumpPostgresData(inner, opts),
      loadData: (dump) => loadPostgresData(inner, dump),
    };
  }
  return {
    listUserTables: () => listSqliteUserTables(inner),
    dumpData: (opts) => dumpSqliteData(inner, opts),
    loadData: (dump) => loadSqliteData(inner, dump),
  };
}

export async function listUserTables(
  client: SqlClient
): Promise<readonly string[]> {
  return bindSqlDataSnapshot(client).listUserTables();
}

export async function dumpData(
  client: SqlClient,
  opts?: SqlDataDumpOptions
): Promise<SqlDataDump> {
  return bindSqlDataSnapshot(client).dumpData(opts);
}

export async function loadData(
  client: SqlClient,
  dump: SqlDataDump
): Promise<void> {
  return bindSqlDataSnapshot(client).loadData(dump);
}
