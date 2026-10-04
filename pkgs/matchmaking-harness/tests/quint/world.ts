/**
 * The world a matchmaking model's traces run in: the example app's lobby
 * behind three replicas sharing one store, opened by the binding's `init`
 * and disposed after the last step. Requests land at the replicas in turn,
 * so nothing but the product decides the outcome; state is compared right
 * after each step (nothing here waits on time).
 */

import type { Run } from '@pkgs/harness-shared/run-types';
import { registerTestCrashHandler } from '@pkgs/matchmaking-harness/crash-handler';
import type { MatchmakingHarness } from '@pkgs/matchmaking-harness/facade';
import type { TraceContext } from '@pkgs/quint-shared/registry';
import { setQuintWorld } from '@pkgs/quint-shared/registry';

export type MatchmakingTraceWorld = {
  readonly ctx: TraceContext;
  harness: Run<MatchmakingHarness> | null;
  /** Every wait ever started, by its id, to the person who started it. */
  readonly waitedBy: Map<string, string>;
  /** How many requests the trace has made (the next replica in turn). */
  requests: number;
  readonly begun: Map<string, number>;
  readonly waits: Map<string, string>;
  readonly numbers: Map<string, number>;
  readonly disposeCrash: () => void;
};

export function traceMatchmaking(
  w: MatchmakingTraceWorld
): Run<MatchmakingHarness> {
  if (w.harness === null) {
    throw new Error('no matchmaking — the binding init opens one');
  }
  return w.harness;
}

export function useMatchmakingTraceWorld(): void {
  setQuintWorld<MatchmakingTraceWorld>({
    create: async (ctx) => ({
      ctx,
      harness: null,
      waitedBy: new Map(),
      requests: 0,
      begun: new Map(),
      waits: new Map(),
      numbers: new Map(),
      disposeCrash: registerTestCrashHandler(),
    }),
    dispose: async (w) => {
      await w.harness?.[Symbol.asyncDispose]();
      w.disposeCrash();
    },
  });
}
