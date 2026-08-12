import type { Timers } from '@pkgs/clock';
import type { SimIo } from '@pkgs/io';
import type { AppHarness } from '@pkgs/ui-testing';
import type { Page } from '@playwright/test';

import type { SeededRng } from './rng';

/** UI backend for each actor session. Default: in-process. */
export type SimulationUiKind = 'in-process' | 'playwright';

/** Context passed to {@link SimulationSystem.start}. */
export type SimulationStartContext = {
  /** Seeded deterministic I/O bag (clock, timers, ids, random, http). */
  readonly io: SimIo;
  /** Extra RNG stream (same seed family) for system-side forks. */
  readonly rng: SeededRng;
  readonly ui: SimulationUiKind;
};

/**
 * Opaque full-system bootstrap — owns servers, DBs, fakes, shared in-proc
 * backend. Implemented by the consumer (or a demo fixture in this package).
 */
export type SimulationSystem = {
  start(ctx: SimulationStartContext): Promise<SimulationSystemHandle>;
};

export type SimulationSystemHandle = {
  /** Create an isolated user session (own client stack + UI root). */
  createSession(actorId: string): Promise<SimulationSession>;
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
