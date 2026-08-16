/**
 * Injected ports so `@pkgs/system-console` never imports apps/libs/test.
 */

import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { World } from '@pkgs/system';
import type { ComponentType } from 'react';

export type EmbeddedProductAppProps<R = unknown> = {
  readonly io: Io;
  readonly resources: R;
  readonly embedded: true;
};

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

export type PlaygroundActor<R = unknown> = PlaygroundSqlNode & {
  readonly io: Io;
  readonly resources: R;
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
  readonly io: Io;
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
};

export type PlaygroundSnapshotManifest = {
  readonly version: 1;
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
  readonly keys: {
    readonly serverSql: string;
    readonly clientSql: Readonly<Record<string, string>>;
  };
};

export type PlaygroundSession<R = unknown> = {
  readonly world: World;
  readonly io: Io;
  /** Live product clients keyed by instance id (`alice`, `bob`, …). */
  readonly clients: ReadonlyMap<string, PlaygroundActor<R>>;
  readonly server: PlaygroundSqlNode;
  readonly pubsub: PlaygroundPubSubNode;
  /** Live room topics from the in-process room node. */
  readonly rooms: ReadonlyMap<string, PlaygroundRoomNode>;
  /**
   * Monotonic UI revision — bumps on every session notify (client/room map
   * changes, end of snapshot restore, etc.).
   */
  readonly revision: number;
  /**
   * Bumps only after snapshot restore (`runQuiet`). Use for remounting
   * embedded ProductApp so room/client notifies do not tear down live UI.
   */
  readonly snapshotEpoch: number;
  /**
   * True while a snapshot load is tearing down / restoring clients. UI should
   * paint no ProductApps until restore finishes.
   */
  readonly snapshotRestoring: boolean;
  /** Subscribe to client / room map changes. */
  subscribe(listener: () => void): () => void;
  addClient(id?: string): Promise<PlaygroundActor<R>>;
  removeClient(id: string): Promise<void>;
  listCommands(): readonly PlaygroundCommand[];
  runCommand(id: string): Promise<void>;
  /** Fault / clock / snapshot entries for the command palette. */
  listPaletteCommands(): readonly PlaygroundPaletteCommand[];
  /** Refresh async snapshot-load palette entries from ObjectStore. */
  refreshSnapshotPaletteCommands(): Promise<void>;
  listSnapshots(): Promise<readonly PlaygroundSnapshotInfo[]>;
  saveSnapshot(label?: string): Promise<PlaygroundSnapshotInfo>;
  loadSnapshot(id: string): Promise<void>;
  deleteSnapshot(id: string): Promise<void>;
  /** Pause / resume wall→sim clock advance. */
  setClockPaused(paused: boolean): void;
  isClockPaused(): boolean;
  /**
   * Tear down the live in-memory session (SQL handles + World).
   * Snapshots in ObjectStore are kept. Caller should remount with
   * `skipSnapshotLoad: true` for a blank reboot.
   */
  wipe(): Promise<void>;
  dispose(): Promise<void>;
};

export type BootPlaygroundOptions = {
  /** Reboot blank without auto-loading the newest ObjectStore snapshot. */
  readonly skipSnapshotLoad?: boolean;
};

export type SystemConsolePorts<R = unknown> = {
  readonly ProductApp: ComponentType<EmbeddedProductAppProps<R>>;
  readonly bootPlayground: (
    opts?: BootPlaygroundOptions
  ) => Promise<PlaygroundSession<R>>;
  /** Process I/O for report HTTP (and playground actor Io is separate). */
  readonly io: Io;
  /**
   * Base path for the mounted console Hono app (no trailing slash).
   * Default `/system-console`.
   */
  readonly reportApiBasePath?: string;
};
