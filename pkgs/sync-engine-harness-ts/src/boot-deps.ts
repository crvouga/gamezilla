import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { Scheduler as VirtualScheduler } from '@pkgs/harness-root-shared-ts/scheduler';
import type { SeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';

/**
 * Ports the sync harness boot needs from a DST {@link Session}.
 * Replaces the old harness {@code KitPorts} bag.
 */
export type SyncBootDeps = {
  readonly clock: Clock;
  readonly scheduler: VirtualScheduler;
  readonly timers: Timers;
  readonly rng: SeededRng;
};
