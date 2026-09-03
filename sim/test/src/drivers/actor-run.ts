/**
 * One actor's slice of a {@link Run}: the run-backed driver plus the two
 * time verbs flows need — `passTime` and `pollUntil`. Virtual time only; no
 * wall deadlines live in product flows.
 */

import type { Run } from '@pkgs/dst';
import type { Driver } from '@pkgs/ui-testing';

import { passTime } from '../scenario/actions';
import type { ProductSurface } from '../scenario/surface';
import { createRunDriver } from '../setup/run-driver';

const DEFAULT_STEP_MS = 100;

export type PollOptions = {
  /** Virtual time budget across all polls. */
  readonly maxMs: number;
  /** Virtual time advanced between polls. */
  readonly stepMs?: number;
  readonly description: string;
};

export class ActorRun {
  readonly ui: Driver;

  constructor(
    readonly run: Run<ProductSurface>,
    readonly actorId: string
  ) {
    this.ui = createRunDriver(run, actorId);
  }

  /** Advance the run one checkpoint; invalidates memoised observations. */
  async passTime(ms: number = DEFAULT_STEP_MS): Promise<void> {
    await this.run.apply(passTime, ms);
  }

  /**
   * Re-read `probe` across `passTime` checkpoints until it yields a value.
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
      await this.passTime(stepMs);
      waited += stepMs;
    }
  }
}
