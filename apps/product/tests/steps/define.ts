/** Step definers for live health scenarios, bound to {@link LiveWorld}. */

import { stepsFor } from '@pkgs/gherkin/registry';
import type { LiveWorld } from './live-world';

export const { Given, When, Then, Step } = stepsFor<LiveWorld>();

/** Right after a deploy a custom domain or Worker may still be warming up. */
export const WARMUP_MS = 5 * 60 * 1000;

/** Poll `probe` until it holds or `maxWaitMs` passes; the last verdict wins. */
export async function eventually(
  probe: () => Promise<boolean>,
  opts: {
    readonly maxWaitMs: number;
    readonly retryMs: number;
    readonly now: () => number;
    readonly sleep: (ms: number) => Promise<void>;
  }
): Promise<boolean> {
  const deadline = opts.now() + opts.maxWaitMs;
  for (;;) {
    if (await probe()) return true;
    if (opts.now() >= deadline) return false;
    await opts.sleep(opts.retryMs);
  }
}
