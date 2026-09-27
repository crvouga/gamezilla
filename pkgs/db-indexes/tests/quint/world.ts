/**
 * The world an index-tuning model's traces run in: the tuning sim the
 * binding's `init` opens, disposed after the last step. Tuning settles within
 * the action that runs it, so the state is compared right after each step.
 */

import type { IndexTuning } from '@pkgs/db-indexes/sim';
import { setQuintWorld, type TraceContext } from '@pkgs/quint/registry';
import type { Run } from '@pkgs/sim';

export type TuningTraceWorld = {
  readonly ctx: TraceContext;
  sim: Run<IndexTuning> | null;
};

export function traceTuning(w: TuningTraceWorld): Run<IndexTuning> {
  if (w.sim === null)
    throw new Error('no tuning sim — the binding init opens one');
  return w.sim;
}

export function useTuningTraceWorld(): void {
  setQuintWorld<TuningTraceWorld>({
    create: async (ctx) => ({ ctx, sim: null }),
    dispose: async (w) => {
      await w.sim?.[Symbol.asyncDispose]();
    },
  });
}
