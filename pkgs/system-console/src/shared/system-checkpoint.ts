/**
 * Full World checkpoint for playground time travel and DST report replay.
 * Playground capture always stores sqlite-mem SQLM blobs. DST reports store
 * native sqlite images; the console converts those to SQLM before restore.
 */

export type SystemCheckpointSqlFormat = 'sqlm' | 'sqlite3-image';

export type SystemCheckpointRoomDump = {
  readonly entries: readonly unknown[];
  readonly dedup: Readonly<Record<string, unknown>>;
};

export type SystemCheckpoint = {
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
  readonly sqlFormat: SystemCheckpointSqlFormat;
  readonly serverSql: Uint8Array;
  readonly clientSql: Readonly<Record<string, Uint8Array>>;
  readonly clientKv: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly rooms: Readonly<Record<string, SystemCheckpointRoomDump>>;
};
