import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { Scheduler as VirtualScheduler } from '@pkgs/harness-root-shared/scheduler';
import type { SeededRng } from '@pkgs/uuid-shared/seeded-rng';

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
