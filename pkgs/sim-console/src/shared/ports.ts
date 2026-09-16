/**
 * Injected ports so `@pkgs/sim-console` never imports apps/libs/test.
 */

import type { Clock, Timers } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Component as SolidComponent } from 'solid-js';

import type { SimCheckpoint } from './sim-checkpoint';

export type {
  SimCheckpoint,
  SimCheckpointRoomDump,
  SimCheckpointSqlFormat,
} from './sim-checkpoint';

export type ProductSimulatorLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ProductSimulatorLogEntry = {
  readonly at: number;
  readonly level: ProductSimulatorLogLevel;
  readonly msg: string;
  readonly context?: Record<string, unknown>;
};

export type ProductSimulatorLogBuffer = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => readonly ProductSimulatorLogEntry[];
  readonly append: (entry: ProductSimulatorLogEntry) => void;
};

export type ProductSimulatorNode = {
  readonly id: string;
  readonly address: string;
  readonly logs: ProductSimulatorLogBuffer;
};

export type ProductSimulatorSqlNode = ProductSimulatorNode & {
  readonly sqlClient: SqlClient;
};

export type ProductSimulatorActorView =
  | {
      /** Solid product `App`; the console hosts it in a DOM element (web only). */
      readonly kind: 'solid';
      readonly App: SolidComponent<{
        readonly embedded?: boolean;
        readonly history?: ProductSimulatorMemoryHistory;
      }>;
      /**
       * Owned outside keyed remounts so MemoryRouter location survives
       * `snapshotEpoch` remounts; seeded from client Kv on spawn.
       */
      readonly history: ProductSimulatorMemoryHistory;
    }
  | {
      readonly kind: 'url';
      readonly url: string;
    };

/**
 * Structural match for `@solidjs/router` `MemoryHistory` — kept here so the
 * console never imports the router package.
 */
export type ProductSimulatorMemoryHistory = {
  readonly get: () => string;
  readonly set: (change: {
    value: string;
    replace?: boolean;
    scroll?: boolean;
  }) => void;
  readonly go: (delta: number) => void;
  readonly listen: (listener: (value: string) => void) => () => void;
};

export type ProductSimulatorActor = ProductSimulatorSqlNode & {
  readonly view: ProductSimulatorActorView;
};

export type ProductSimulatorRoomSnapshot = {
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

export type ProductSimulatorRoomNode = ProductSimulatorNode & {
  inspect(): ProductSimulatorRoomSnapshot | null;
};

export type ProductSimulatorPubSubTopicStat = {
  readonly topic: string;
  readonly subscriberCount: number;
  readonly instanceCount: number;
};

export type ProductSimulatorPubSubNode = ProductSimulatorNode & {
  listTopicStats(): readonly ProductSimulatorPubSubTopicStat[];
};

export type ProductSimulatorCommandContext = {
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

export type ProductSimulatorCommand = {
  readonly id: string;
  readonly label: string;
  run(ctx: ProductSimulatorCommandContext): Promise<void>;
};

/** Searchable command-palette entries (faults, clock, snapshots). */
export type ProductSimulatorPaletteCommand = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly category?: string;
  readonly keywords?: readonly string[];
  run(): void | Promise<void>;
};

export type ProductSimulatorSnapshotInfo = {
  readonly id: string;
  readonly label: string;
  readonly createdAtMs: number;
  readonly compatible: boolean;
  readonly incompatibleReason?: string;
  /** Total ObjectStore bytes under `snapshots/{id}/` (SQL + KV + rooms + manifest). */
  readonly totalBytes?: number;
};

export type ProductSimulatorSnapshotManifest = {
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

export type ProductSimulatorClock = {
  readonly now: () => number;
  readonly advance: (ms: number) => void;
  readonly reset: (ms: number) => void;
};

export type ProductSimulatorSession = {
  readonly clock: ProductSimulatorClock;
  crash(id: string): void;
  restart(id: string): void;
  partition(a: string, b: string): void;
  heal(a?: string, b?: string): void;
  readonly clients: ReadonlyMap<string, ProductSimulatorActor>;
  readonly server: ProductSimulatorSqlNode;
  readonly pubsub: ProductSimulatorPubSubNode;
  readonly rooms: ReadonlyMap<string, ProductSimulatorRoomNode>;
  readonly revision: number;
  readonly snapshotEpoch: number;
  readonly snapshotRestoring: boolean;
  subscribe(listener: () => void): () => void;
  addClient(id?: string): Promise<ProductSimulatorActor>;
  removeClient(id: string): Promise<void>;
  listCommands(): readonly ProductSimulatorCommand[];
  runCommand(id: string): Promise<void>;
  listPaletteCommands(): readonly ProductSimulatorPaletteCommand[];
  refreshSnapshotPaletteCommands(): Promise<void>;
  listSnapshots(): Promise<readonly ProductSimulatorSnapshotInfo[]>;
  saveSnapshot(label?: string): Promise<ProductSimulatorSnapshotInfo>;
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

export type BootProductSimulatorOptions = {
  readonly skipSnapshotLoad?: boolean;
};

export type SimConsolePorts = {
  readonly bootProductSimulator: (
    opts?: BootProductSimulatorOptions
  ) => Promise<ProductSimulatorSession>;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  /**
   * Durable store for per-node SQL notebooks (OPFS / filesystem). When omitted,
   * notebooks fall back to an in-memory ObjectStore (lost on reload).
   */
  readonly notebookStore?: ObjectStore;
};
