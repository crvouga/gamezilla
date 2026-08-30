/**
 * Native (iOS/Android) real fabric: mem engines (postgres-mem + sqlite-mem).
 * Metro loads this instead of {@link ./sim-sql-fabric-real.ts} so Hermes never
 * sees better-sqlite3, bun:sqlite, or PGlite WASM.
 */

import type { Clock } from '@pkgs/clock';
import type { SimCheckpointSqlFormat } from '@pkgs/sim-console/shared/sim-checkpoint';
import {
  MEM_CHECKPOINT_SQL_FORMAT,
  openMemClientSql,
  openMemServerSql,
  openMemServerSqlFromSeed,
} from './sim-sql-fabric-mem';
import type { SimSqlHandle } from './sim-sql-handle';

export const REAL_CHECKPOINT_SQL_FORMAT: SimCheckpointSqlFormat =
  MEM_CHECKPOINT_SQL_FORMAT;

export async function openRealClientSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  const handle = openMemClientSql(logicalName, clock);
  await handle.sqlClient.connect();
  return handle;
}

export async function openRealServerSql(
  logicalName: string,
  clock: Clock
): Promise<SimSqlHandle> {
  const handle = openMemServerSql(logicalName, clock);
  await handle.sqlClient.connect();
  return handle;
}

export function openRealServerSqlFromSeed(
  logicalName: string,
  clock: Clock,
  seedBytes: Uint8Array
): Promise<SimSqlHandle> {
  return openMemServerSqlFromSeed(logicalName, clock, seedBytes);
}
