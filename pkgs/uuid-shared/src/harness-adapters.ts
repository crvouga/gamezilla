import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { HarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { Timers } from '@pkgs/clock-shared/types';
import { createHarnessIds } from './seeded-create-id';
import type { HarnessIds } from './seeded-create-id';

export type HarnessAdapters = HarnessIds & {
  readonly clock: HarnessClock;
  readonly timers: Timers;
};

/** Virtual clock + seeded ids for tests and harness hosts (not an Io bag). */
export function createHarnessAdapters(args: {
  readonly seed: number | bigint | string;
  readonly startMs?: number;
}): HarnessAdapters {
  const { clock, timers } = createHarnessClock({
    ...(args.startMs !== undefined ? { startMs: args.startMs } : {}),
  });
  return { clock, timers, ...createHarnessIds(args.seed) };
}
