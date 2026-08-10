import type { SimulationSystem, SimulationUiKind } from './system-port';

export type { SimulationUiKind };

export type SimulationOptions = {
  readonly seed: number | bigint | string;
  /** Opaque full-system bootstrap — owns servers, DBs, fakes, shared backend. */
  readonly system: SimulationSystem;
  /**
   * UI driver kind. Default `'in-process'` (React tree in Bun via
   * `@pkgs/ui-testing`). `'playwright'` requires each session to supply a Page.
   */
  readonly ui?: SimulationUiKind;
  /** Virtual clock start (epoch ms). Default `0`. */
  readonly startMs?: number;
};
