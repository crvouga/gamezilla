import type { Clock, Timers } from '@pkgs/clock';
import type { VirtualScheduler } from '@pkgs/dst/kernel';
import type { SeededRng } from '@pkgs/uuid';

/**
 * Ports the sync sim boot needs from a DST {@link Session}.
 * Replaces the old harness {@code KitPorts} bag.
 */
export type SyncBootDeps = {
  readonly clock: Clock;
  readonly scheduler: VirtualScheduler;
  readonly timers: Timers;
  readonly rng: SeededRng;
};
