import {
  createHarnessClock,
  type HarnessClock,
} from '@pkgs/clock-shared-ts/harness-clock';
import type { Clock } from '@pkgs/clock-shared-ts/types';

/** The clock used by this world's worker endpoints and their lease observations. */
const timelines = new WeakMap<Clock, Clock>();

export function workerNow(base: Clock): number {
  return (timelines.get(base) ?? base).now();
}

/** Drive a complete observation window, then resume from its last instant. */
export async function duringWorkerWindow(
  base: Clock,
  observe: (clock: HarnessClock) => Promise<void>
): Promise<void> {
  const { clock } = createHarnessClock({ startMs: workerNow(base) });
  timelines.set(base, clock);
  try {
    await observe(clock);
  } finally {
    const offset = clock.now() - base.now();
    timelines.set(base, { now: () => base.now() + offset });
  }
}
