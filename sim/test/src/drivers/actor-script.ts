/**
 * One actor's slice of a {@link Run}: the run-backed driver plus the two
 * time verbs flows need — `elapse` and `pollUntil`. Virtual time only; no
 * wall deadlines live in product flows.
 */

import type { Run } from '@pkgs/sim';
import type { Driver } from '@pkgs/ui-testing';
import { createScriptDriver } from '../setup/script-driver';
import type { ProductSim } from '../sim/sim';

const DEFAULT_STEP_MS = 100;

export type PollOptions = {
  /** Virtual time budget across all polls. */
  readonly maxMs: number;
  /** Virtual time advanced between polls. */
  readonly stepMs?: number;
  readonly description: string;
};

export class ActorScript {
  readonly ui: Driver;

  constructor(
    readonly s: Run<ProductSim>,
    readonly actorId: string
  ) {
    this.ui = createScriptDriver(s, actorId);
  }

  /** Advance the run one checkpoint; invalidates memoised reads. */
  async elapse(ms: number = DEFAULT_STEP_MS): Promise<void> {
    await this.s.advanceTime(ms);
  }

  /**
   * Re-read `probe` across `elapse` checkpoints until it yields a value.
   * `probe` returning `null` means "not yet".
   */
  async pollUntil<T>(
    probe: () => Promise<T | null>,
    opts: PollOptions
  ): Promise<T> {
    const stepMs = opts.stepMs ?? DEFAULT_STEP_MS;
    let waited = 0;
    for (;;) {
      const found = await probe();
      if (found !== null) return found;
      if (waited >= opts.maxMs) {
        throw new Error(
          `Timed out after ${String(opts.maxMs)}ms waiting for ${opts.description}`
        );
      }
      await this.elapse(stepMs);
      waited += stepMs;
    }
  }
}
