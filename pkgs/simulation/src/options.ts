import type { SimulationReportOptions } from './report/types';
import type { SimulationSystem, SimulationUiKind } from './system-port';

export type { SimulationReportOptions, SimulationUiKind };

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
   * When set, record every Driver mutation/wait + `open` into a Playwright-like
   * HTML timeline report with per-step UI HTML snapshots.
   */
  readonly report?: boolean | SimulationReportOptions;
};
