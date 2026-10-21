/**
 * Injected ports so `@pkgs/harness-console` never imports apps/libs/test.
 */

import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Component as SolidComponent } from 'solid-js';

import type { HarnessCheckpoint } from './checkpoint';

export type ProductHarnessLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ProductHarnessLogEntry = {
  readonly at: number;
  readonly level: ProductHarnessLogLevel;
  readonly msg: string;
  readonly context?: Record<string, unknown>;
};

export type ProductHarnessLogBuffer = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => readonly ProductHarnessLogEntry[];
  readonly append: (entry: ProductHarnessLogEntry) => void;
};

export type ProductHarnessNode = {
  readonly id: string;
  readonly address: string;
  readonly logs: ProductHarnessLogBuffer;
};

export type ProductHarnessSqlNode = ProductHarnessNode & {
  readonly sqlClient: SqlClient;
};

export type ProductHarnessActorView =
  | {
      /** Solid product `App`; the console hosts it in a DOM element (web only). */
      readonly kind: 'solid';
      readonly App: SolidComponent<{
        readonly embedded?: boolean;
        readonly history?: ProductHarnessMemoryHistory;
      }>;
      /**
       * Owned outside keyed remounts so MemoryRouter location survives
       * `snapshotEpoch` remounts; seeded from client Kv on spawn.
       */
      readonly history: ProductHarnessMemoryHistory;
    }
  | {
      readonly kind: 'url';
      readonly url: string;
    };

/**
 * Structural match for `@solidjs/router` `MemoryHistory` — kept here so the
 * console never imports the router package.
 */
export type ProductHarnessMemoryHistory = {
  readonly get: () => string;
  readonly set: (change: {
    value: string;
    replace?: boolean;
    scroll?: boolean;
  }) => void;
  readonly go: (delta: number) => void;
  readonly listen: (listener: (value: string) => void) => () => void;
};

export type ProductHarnessActor = ProductHarnessSqlNode & {
  readonly view: ProductHarnessActorView;
};

export type ProductHarnessRoomSnapshot = {
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

export type ProductHarnessRoomNode = ProductHarnessNode & {
  inspect(): ProductHarnessRoomSnapshot | null;
};

export type ProductHarnessPubSubTopicStat = {
  readonly topic: string;
  readonly subscriberCount: number;
  readonly instanceCount: number;
};

export type ProductHarnessPubSubNode = ProductHarnessNode & {
  listTopicStats(): readonly ProductHarnessPubSubTopicStat[];
};

export type ProductHarnessLoadBalancerRoute = {
  readonly at: number;
  readonly from: string;
  /** Chosen backend id, or `null` when every backend was unreachable. */
  readonly to: string | null;
  readonly method: string;
  readonly path: string;
};

export type ProductHarnessLoadBalancerBackend = {
  readonly id: string;
  readonly reachable: boolean;
  readonly requests: number;
};

export type ProductHarnessLoadBalancerSnapshot = {
  readonly id: string;
  readonly algorithm: 'round-robin';
  /** Index of the backend the next request will try first. */
  readonly cursor: number;
  readonly requests: number;
  readonly rejected: number;
  readonly backends: readonly ProductHarnessLoadBalancerBackend[];
  readonly recentRoutes: readonly ProductHarnessLoadBalancerRoute[];
};

/** Ingress node every client addresses; round-robins across server nodes. */
export type ProductHarnessLoadBalancerNode = ProductHarnessNode & {
  inspect(): ProductHarnessLoadBalancerSnapshot;
};

export type ProductHarnessCommandContext = {
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

export type ProductHarnessCommand = {
  readonly id: string;
  readonly label: string;
  run(ctx: ProductHarnessCommandContext): Promise<void>;
};

/** Searchable command-palette entries (faults, clock, snapshots). */
export type ProductHarnessPaletteCommand = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly category?: string;
  readonly keywords?: readonly string[];
  run(): void | Promise<void>;
};

export type ProductHarnessSnapshotInfo = {
  readonly id: string;
  readonly label: string;
  readonly createdAtMs: number;
  readonly compatible: boolean;
  readonly incompatibleReason?: string;
  /** Total ObjectStore bytes under `snapshots/{id}/` (SQL + KV + rooms + manifest). */
  readonly totalBytes?: number;
};

export type ProductHarnessSnapshotManifest = {
  readonly version: 3;
  readonly localSchemaVersion: number;
  readonly id: string;
  readonly label: string;
  readonly createdAtMs: number;
  readonly clockMs: number;
  readonly clockPaused: boolean;
  readonly clientIds: readonly string[];
  readonly serverIds: readonly string[];
  readonly roomTopics: readonly string[];
  readonly partitions: readonly string[];
  readonly skewByAddress: Readonly<Record<string, number>>;
  readonly downAddresses: readonly string[];
  readonly evictedAddresses: readonly string[];
  readonly sqlFormat?:
    | import('./checkpoint').HarnessCheckpointSqlFormat
    | undefined;
  readonly keys: {
    readonly serverSql: string;
    readonly clientSql: Readonly<Record<string, string>>;
  };
};

export type ProductHarnessClock = {
  readonly now: () => number;
  readonly advance: (ms: number) => void;
  readonly reset: (ms: number) => void;
};

export type ProductHarnessSession = {
  readonly clock: ProductHarnessClock;
  crash(id: string): void;
  restart(id: string): void;
  partition(a: string, b: string): void;
  heal(a?: string, b?: string): void;
  readonly clients: ReadonlyMap<string, ProductHarnessActor>;
  /** Live API instances, in balancer rotation order. All share one DB. */
  readonly servers: ReadonlyMap<string, ProductHarnessSqlNode>;
  readonly loadBalancer: ProductHarnessLoadBalancerNode;
  readonly pubsub: ProductHarnessPubSubNode;
  readonly rooms: ReadonlyMap<string, ProductHarnessRoomNode>;
  readonly revision: number;
  readonly snapshotEpoch: number;
  readonly snapshotRestoring: boolean;
  subscribe(listener: () => void): () => void;
  addClient(id?: string): Promise<ProductHarnessActor>;
  removeClient(id: string): Promise<void>;
  /** Boot another API instance into the rotation (`server-b`, `server-c`, …). */
  addServer(id?: string): Promise<ProductHarnessSqlNode>;
  /** Retire an API instance. Rejects on the last one — crash it instead. */
  removeServer(id: string): Promise<void>;
  listCommands(): readonly ProductHarnessCommand[];
  runCommand(id: string): Promise<void>;
  listPaletteCommands(): readonly ProductHarnessPaletteCommand[];
  refreshSnapshotPaletteCommands(): Promise<void>;
  listSnapshots(): Promise<readonly ProductHarnessSnapshotInfo[]>;
  saveSnapshot(label?: string): Promise<ProductHarnessSnapshotInfo>;
  loadSnapshot(id: string): Promise<void>;
  deleteSnapshot(id: string): Promise<void>;
  deleteSnapshots(ids: readonly string[]): Promise<void>;
  purgeIncompatibleSnapshots(): Promise<number>;
  setClockPaused(paused: boolean): void;
  isClockPaused(): boolean;
  exportSqlBytes(): Promise<Readonly<Record<string, Uint8Array>>>;
  captureCheckpoint(label?: string): Promise<HarnessCheckpoint>;
  restoreCheckpoint(checkpoint: HarnessCheckpoint): Promise<void>;
  subscribeDomainWake(listener: (label: string) => void): () => void;
  wipe(): Promise<void>;
  dispose(): Promise<void>;
};

export type BootProductHarnessOptions = {
  readonly skipSnapshotLoad?: boolean;
};

export type HarnessConsolePorts = {
  readonly bootProductHarness: (
    opts?: BootProductHarnessOptions
  ) => Promise<ProductHarnessSession>;
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
