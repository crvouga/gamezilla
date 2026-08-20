import { createSimClock, type SimClock, type Timers } from '@pkgs/clock';
import { createSimIds, type SimIds } from './seeded-create-id';

export type SimAdapters = SimIds & {
  readonly clock: SimClock;
  readonly timers: Timers;
};

/** Virtual clock + seeded ids for tests and sim hosts (not an Io bag). */
export function createSimAdapters(args: {
  readonly seed: number | bigint | string;
  readonly startMs?: number;
}): SimAdapters {
  const { clock, timers } = createSimClock({
    ...(args.startMs !== undefined ? { startMs: args.startMs } : {}),
  });
  return { clock, timers, ...createSimIds(args.seed) };
}
