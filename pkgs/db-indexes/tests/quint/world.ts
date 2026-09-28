/**
 * The world an index-tuning model's traces run in: the tuning harness the
 * binding's `init` opens, disposed after the last step. Tuning settles within
 * the action that runs it, so the state is compared right after each step.
 */

import type { IndexTuning } from '@pkgs/db-indexes/harness';
import type { Run } from '@pkgs/harness';
import { setQuintWorld, type TraceContext } from '@pkgs/quint/registry';

export type TuningTraceWorld = {
  readonly ctx: TraceContext;
  harness: Run<IndexTuning> | null;
};

export function traceTuning(w: TuningTraceWorld): Run<IndexTuning> {
  if (w.harness === null)
    throw new Error('no tuning harness — the binding init opens one');
  return w.harness;
}

export function useTuningTraceWorld(): void {
  setQuintWorld<TuningTraceWorld>({
    create: async (ctx) => ({ ctx, harness: null }),
    dispose: async (w) => {
      await w.harness?.[Symbol.asyncDispose]();
    },
  });
}
