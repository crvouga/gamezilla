import type { SimulationReportOptions } from '@pkgs/simulation-report';

import type { SimulationSystem, SimulationUiKind } from './system-port';

export type { SimulationReportOptions, SimulationUiKind };

export type SimulationFuzzOptions = {
  /** Fault injection intensity in [0, 1]. */
  readonly intensity: number;
};

export type SimulationOptions = {
  readonly seed: number | bigint | string;
  /** Opaque full-system bootstrap — owns servers, DBs, fakes, shared backend. */
  readonly system: SimulationSystem;
  /**
   * UI driver kind. Default `'in-process'` (React Native tree via RNTL /
   * `@pkgs/ui-testing`). `'playwright'` requires each session to supply a Page.
   */
  readonly ui?: SimulationUiKind;
  /** Virtual clock start (epoch ms). Default `0`. */
  readonly startMs?: number;
  /**
   * When set, record every Driver mutation/wait + `open` into a report
   * timeline with per-step UI HTML frames (view via `@apps/simulation-report`).
   */
  readonly report?: boolean | SimulationReportOptions;
  /**
   * Opt-in fuzz mode: inject seeded faults while scenarios run.
   * Off by default so scripted product tests stay deterministic-by-script.
   */
  readonly fuzz?: SimulationFuzzOptions;
};
