/**
 * Full run checkpoint for product-harness time travel and DST report replay.
 * ProductHarness capture stores opaque server/client bytes:
 * - `mixed-pgmm-sqlm` — mockingbird-postgres PGMM + mockingbird-sqlite SQLM (harness fabric)
 * DST reports may still store native sqlite images; the console converts those
 * to SQLM before restore when on the mockingbird SQL fabric.
 */

export type HarnessCheckpointSqlFormat =
  | 'sqlm'
  | 'sqlite3-image'
  | 'logical'
  | 'mixed-pgmm-sqlm';

export type HarnessCheckpointRoomDump = {
  readonly entries: readonly unknown[];
  readonly dedup: Readonly<Record<string, unknown>>;
};

export type HarnessCheckpoint = {
  readonly label: string;
  readonly capturedAtMs: number;
  readonly clockMs: number;
  readonly clockPaused: boolean;
  readonly localSchemaVersion: number;
  readonly clientIds: readonly string[];
  /** API instance ids live at capture time (`server-a`, `server-b`, …). */
  readonly serverIds: readonly string[];
  readonly roomTopics: readonly string[];
  readonly partitions: readonly string[];
  readonly skewByAddress: Readonly<Record<string, number>>;
  readonly downAddresses: readonly string[];
  readonly evictedAddresses: readonly string[];
  readonly sqlFormat: HarnessCheckpointSqlFormat;
  readonly serverSql: Uint8Array;
  readonly clientSql: Readonly<Record<string, Uint8Array>>;
  readonly clientKv: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly rooms: Readonly<Record<string, HarnessCheckpointRoomDump>>;
};
