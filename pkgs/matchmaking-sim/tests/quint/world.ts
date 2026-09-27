/**
 * The world a matchmaking model's traces run in: matchmaking behind three
 * entrances sharing one store, opened by the binding's `init` and disposed
 * after the last step. Every action lands at the entrance the trace drew, so
 * nothing but the product decides the outcome; state is compared right after
 * each step (nothing here waits on time).
 */

import {
  type MatchmakingSim,
  registerTestCrashHandler,
} from '@pkgs/matchmaking-sim';
import { setQuintWorld, type TraceContext } from '@pkgs/quint/registry';
import type { Run } from '@pkgs/sim';

export type MatchmakingTraceWorld = {
  readonly ctx: TraceContext;
  sim: Run<MatchmakingSim> | null;
  /** Every wait ever started, by its id, to the person who started it. */
  readonly waitedBy: Map<string, string>;
  readonly disposeCrash: () => void;
};

export function traceMatchmaking(
  w: MatchmakingTraceWorld
): Run<MatchmakingSim> {
  if (w.sim === null) {
    throw new Error('no matchmaking — the binding init opens one');
  }
  return w.sim;
}

export function useMatchmakingTraceWorld(): void {
  setQuintWorld<MatchmakingTraceWorld>({
    create: async (ctx) => ({
      ctx,
      sim: null,
      waitedBy: new Map(),
      disposeCrash: registerTestCrashHandler(),
    }),
    dispose: async (w) => {
      await w.sim?.[Symbol.asyncDispose]();
      w.disposeCrash();
    },
  });
}
