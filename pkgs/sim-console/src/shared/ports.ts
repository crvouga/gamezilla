/**
 * Injected ports so `@pkgs/sim-console` never imports apps/libs/test.
 */

import type { Clock, Timers } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { ComponentType } from 'react';

import type { SimCheckpoint } from './sim-checkpoint';

export type {
  SimCheckpoint,
  SimCheckpointRoomDump,
  SimCheckpointSqlFormat,
} from './sim-checkpoint';

export type PlaygroundLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type PlaygroundLogEntry = {
  readonly at: number;
  readonly level: PlaygroundLogLevel;
  readonly msg: string;
  readonly context?: Record<string, unknown>;
};

export type PlaygroundLogBuffer = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => readonly PlaygroundLogEntry[];
  readonly append: (entry: PlaygroundLogEntry) => void;
};

export type PlaygroundNode = {
  readonly id: string;
  readonly address: string;
  readonly logs: PlaygroundLogBuffer;
};

export type PlaygroundSqlNode = PlaygroundNode & {
  readonly sqlClient: SqlClient;
};

export type PlaygroundActor = PlaygroundSqlNode & {
  readonly App: ComponentType<{ readonly embedded?: boolean }>;
};

export type PlaygroundRoomSnapshot = {
  readonly topic: string;
  readonly committedState: unknown;
  readonly roster: readonly {
    readonly id: string;
    readonly clientId: string;
  }[];
  readonly lastSeq: number;
  readonly entries: readonly unknown[];
  readonly dedupSize: number;
};

export type PlaygroundRoomNode = PlaygroundNode & {
  inspect(): PlaygroundRoomSnapshot | null;
};

export type PlaygroundPubSubTopicStat = {
  readonly topic: string;
  readonly subscriberCount: number;
  readonly instanceCount: number;
};

export type PlaygroundPubSubNode = PlaygroundNode & {
  listTopicStats(): readonly PlaygroundPubSubTopicStat[];
};

export type PlaygroundCommandContext = {
  readonly serverSql: SqlClient;
  readonly now: () => number;
  readonly createId: () => string;
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly notifySyncWake?: (args: {
    readonly topics: readonly string[];
    readonly tables?: readonly string[];
    readonly label: string;
  }) => Promise<void>;
};

export type PlaygroundCommand = {
  readonly id: string;
  readonly label: string;
  run(ctx: PlaygroundCommandContext): Promise<void>;
};

/** Searchable command-palette entries (faults, clock, snapshots). */
export type PlaygroundPaletteCommand = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly category?: string;
  readonly keywords?: readonly string[];
  run(): void | Promise<void>;
};

export type PlaygroundSnapshotInfo = {
  readonly id: string;
  readonly label: string;
  readonly createdAtMs: number;
  readonly compatible: boolean;
  readonly incompatibleReason?: string;
  /** Total ObjectStore bytes under `snapshots/{id}/` (SQL + KV + rooms + manifest). */
  readonly totalBytes?: number;
};

export type PlaygroundSnapshotManifest = {
  readonly version: 2;
  readonly localSchemaVersion: number;
  readonly id: string;
  readonly label: string;
  readonly createdAtMs: number;
  readonly clockMs: number;
  readonly clockPaused: boolean;
  readonly clientIds: readonly string[];
  readonly roomTopics: readonly string[];
  readonly partitions: readonly string[];
  readonly skewByAddress: Readonly<Record<string, number>>;
  readonly downAddresses: readonly string[];
  readonly evictedAddresses: readonly string[];
  readonly sqlFormat?:
    | import('./sim-checkpoint').SimCheckpointSqlFormat
    | undefined;
  readonly keys: {
    readonly serverSql: string;
    readonly clientSql: Readonly<Record<string, string>>;
  };
};

export type PlaygroundClock = {
  readonly now: () => number;
  readonly advance: (ms: number) => void;
  readonly reset: (ms: number) => void;
};

export type PlaygroundSession = {
  readonly clock: PlaygroundClock;
  crash(id: string): void;
  restart(id: string): void;
  partition(a: string, b: string): void;
  heal(a?: string, b?: string): void;
  readonly clients: ReadonlyMap<string, PlaygroundActor>;
  readonly server: PlaygroundSqlNode;
  readonly pubsub: PlaygroundPubSubNode;
  readonly rooms: ReadonlyMap<string, PlaygroundRoomNode>;
  readonly revision: number;
  readonly snapshotEpoch: number;
  readonly snapshotRestoring: boolean;
  subscribe(listener: () => void): () => void;
  addClient(id?: string): Promise<PlaygroundActor>;
  removeClient(id: string): Promise<void>;
  listCommands(): readonly PlaygroundCommand[];
  runCommand(id: string): Promise<void>;
  listPaletteCommands(): readonly PlaygroundPaletteCommand[];
  refreshSnapshotPaletteCommands(): Promise<void>;
  listSnapshots(): Promise<readonly PlaygroundSnapshotInfo[]>;
  saveSnapshot(label?: string): Promise<PlaygroundSnapshotInfo>;
  loadSnapshot(id: string): Promise<void>;
  deleteSnapshot(id: string): Promise<void>;
  deleteSnapshots(ids: readonly string[]): Promise<void>;
  purgeIncompatibleSnapshots(): Promise<number>;
  setClockPaused(paused: boolean): void;
  isClockPaused(): boolean;
  exportSqlBytes(): Promise<Readonly<Record<string, Uint8Array>>>;
  captureCheckpoint(label?: string): Promise<SimCheckpoint>;
  restoreCheckpoint(checkpoint: SimCheckpoint): Promise<void>;
  subscribeDomainWake(listener: (label: string) => void): () => void;
  wipe(): Promise<void>;
  dispose(): Promise<void>;
};

export type BootPlaygroundOptions = {
  readonly skipSnapshotLoad?: boolean;
};

export type SimConsolePorts = {
  readonly bootPlayground: (
    opts?: BootPlaygroundOptions
  ) => Promise<PlaygroundSession>;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  /**
   * Static / ObjectStore-backed report artifacts (Expo `public/reports`).
   * When set, the console reads reports client-side with no report server.
   */
  readonly reportsStore?: ObjectStore;
  /** Public URL base for report assets (default `/reports`). */
  readonly reportsPublicBaseUrl?: string;
};
