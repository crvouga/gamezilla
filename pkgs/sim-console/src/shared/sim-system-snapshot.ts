/**
 * Portable logical World snapshot — one JSON file per committed test fixture.
 * SQL slices use {@link SqlDataDump}; schema comes from migrate / seed only.
 */

import type { SqlDataDump } from '@pkgs/sql-client/interface';
import type { SimCheckpointRoomDump } from './sim-checkpoint';

export const SIM_SYSTEM_SNAPSHOT_VERSION = 1 as const;

export type SimSystemSnapshotClientSlice = {
  readonly tables: SqlDataDump;
  readonly kv: Readonly<Record<string, string>>;
};

export type SimSystemSnapshot = {
  readonly version: typeof SIM_SYSTEM_SNAPSHOT_VERSION;
  readonly localSchemaVersion: number;
  readonly clockMs: number;
  readonly clockPaused: boolean;
  readonly clientIds: readonly string[];
  readonly roomTopics: readonly string[];
  readonly partitions: readonly string[];
  readonly skewByAddress: Readonly<Record<string, number>>;
  readonly downAddresses: readonly string[];
  readonly evictedAddresses: readonly string[];
  readonly server: SqlDataDump;
  readonly clients: Readonly<Record<string, SimSystemSnapshotClientSlice>>;
  readonly rooms: Readonly<Record<string, SimCheckpointRoomDump>>;
};
