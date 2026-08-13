import type { Timers } from '@pkgs/clock';
import type { SimIo } from '@pkgs/io';
import type { AppHarness } from '@pkgs/ui-testing';
import type { Page } from '@playwright/test';

import type { EventLog } from './events';
import type { SimMesh, SimPubSubBus } from './network';
import type { SeededRng } from './rng';
import type {
  AttributeKind,
  AttributeSnapshot,
  TopologyDefinition,
  TopologyNodeDef,
} from './topology';

/** UI backend for each actor session. Default: in-process. */
export type SimulationUiKind = 'in-process' | 'playwright';

/** Context passed to {@link SimulationSystem.start}. */
export type SimulationStartContext = {
  /** Seeded deterministic I/O bag (clock, timers, ids, random, http). */
  readonly io: SimIo;
  /** Extra RNG stream (same seed family) for system-side forks. */
  readonly rng: SeededRng;
  readonly ui: SimulationUiKind;
  /** Point-to-point mesh owned by the simulation runtime. */
  readonly mesh: SimMesh;
  /** Fine-grained event log owned by the simulation runtime. */
  readonly events: EventLog;
  /**
   * Mesh-aware pubsub bus when the topology declares a broker node.
   * Product systems should register peers and publish through this.
   */
  readonly pubsub?: SimPubSubBus;
};

/**
 * Opaque full-system bootstrap — owns servers, DBs, fakes, shared in-proc
 * backend. Implemented by the consumer (or a demo fixture in this package).
 */
export type SimulationSystem = {
  /** Declarative topology — static nodes spawn at open; others via actor/node. */
  readonly topology: TopologyDefinition;
  start(ctx: SimulationStartContext): Promise<SimulationSystemHandle>;
};

/** @deprecated Prefer topology node sqlite attributes. Kept for one revision. */
export type SimulationSqliteNodeSnapshot = {
  readonly nodeId: string;
  readonly bytes: Uint8Array;
};

export type LiveNodeAdapter = {
  snapshot(attr: AttributeKind): Promise<AttributeSnapshot | null>;
  crash(): Promise<void>;
  restart(): Promise<void>;
  dispose(): Promise<void>;
  corrupt?(attr: 'sqlite'): Promise<void>;
  wipe?(attr: 'sqlite'): Promise<void>;
  /** HTML nodes only — drives UI via `@pkgs/ui-testing`. */
  session?: SimulationSession;
  /** Optional broker helpers. */
  silentDropSubscription?(peerNodeId: string): void;
  clearSilentDrop?(peerNodeId: string): void;
  redeliver?(toNodeId: string): Promise<void>;
  /** Optional clock skew applied inside the adapter's Io. */
  setClockSkewMs?(ms: number): void;
};

export type SimulationSystemHandle = {
  spawn(node: TopologyNodeDef): Promise<LiveNodeAdapter>;
  dispose(): Promise<void>;
};

type SimulationSessionBase = {
  dispose(): Promise<void>;
};

/** Optional wall-clock wait knobs for driver polling (product I/O). */
export type SimulationDriverWait = {
  readonly now: () => number;
  readonly timers: Timers;
};

/** In-process session — feeds `@pkgs/ui-testing` InProcessDriver. */
export type InProcessSimulationSession = SimulationSessionBase & {
  readonly ui: 'in-process';
  readonly harness: AppHarness;
  /**
   * When set, UI waits poll on this clock/timers instead of the simulation
   * virtual clock (needed when real HTTP / Node work must complete).
   */
  readonly driverWait?: SimulationDriverWait;
};

/** Playwright session — feeds `@pkgs/ui-testing` PlaywrightDriver. */
export type PlaywrightSimulationSession = SimulationSessionBase & {
  readonly ui: 'playwright';
  readonly page: Page;
  readonly baseUrl?: string;
};

export type SimulationSession =
  | InProcessSimulationSession
  | PlaywrightSimulationSession;
