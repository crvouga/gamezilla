/**
 * Full run checkpoint for playground time travel and DST report replay.
 * Playground capture stores opaque server/client bytes:
 * - `mixed-pglite-sqlite` — PGlite dump + real SQLite serialize (default `real`)
 * - `mixed-pgmm-sqlm` — postgres-mem PGMM + sqlite-mem SQLM (`mem` fabric)
 * DST reports may still store native sqlite images; the console converts those
 * to SQLM before restore when on the mem fabric.
 */

export type SimCheckpointSqlFormat =
  | 'sqlm'
  | 'sqlite3-image'
  | 'mixed-pgmm-sqlm'
  | 'mixed-pglite-sqlite';

export type SimCheckpointRoomDump = {
  readonly entries: readonly unknown[];
  readonly dedup: Readonly<Record<string, unknown>>;
};

export type SimCheckpoint = {
  readonly label: string;
  readonly capturedAtMs: number;
  readonly clockMs: number;
  readonly clockPaused: boolean;
  readonly localSchemaVersion: number;
  readonly clientIds: readonly string[];
  readonly roomTopics: readonly string[];
  readonly partitions: readonly string[];
  readonly skewByAddress: Readonly<Record<string, number>>;
  readonly downAddresses: readonly string[];
  readonly evictedAddresses: readonly string[];
  readonly sqlFormat: SimCheckpointSqlFormat;
  readonly serverSql: Uint8Array;
  readonly clientSql: Readonly<Record<string, Uint8Array>>;
  readonly clientKv: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly rooms: Readonly<Record<string, SimCheckpointRoomDump>>;
};
