/**
 * Portable logical system snapshot — one JSON file per committed test fixture.
 * SQL slices use {@link SqlDataDump}; schema comes from migrate / seed only.
 */

import type { SqlDataDump } from '@pkgs/sql-client-root-shared-ts/types';
import type { HarnessCheckpointRoomDump } from './checkpoint';

export const HARNESS_SYSTEM_SNAPSHOT_VERSION = 1 as const;

export type HarnessSystemSnapshotClientSlice = {
  readonly tables: SqlDataDump;
  readonly kv: Readonly<Record<string, string>>;
};

export type HarnessSystemSnapshot = {
  readonly version: typeof HARNESS_SYSTEM_SNAPSHOT_VERSION;
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
  readonly clients: Readonly<Record<string, HarnessSystemSnapshotClientSlice>>;
  readonly rooms: Readonly<Record<string, HarnessCheckpointRoomDump>>;
};
