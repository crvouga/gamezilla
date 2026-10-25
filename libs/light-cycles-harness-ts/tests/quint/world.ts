/**
 * The world a Light Cycles model's traces run in: the model arena the
 * binding's `init` opens (real room server, clients, transport and session
 * authority on virtual time), disposed after the last step.
 *
 * The model counts game time itself — a countdown ends, the riders take a
 * step — so its state is compared right after each step: letting time run
 * to settle would move the riders.
 */

import type { ModelArena } from '@libs/light-cycles-harness-ts/light-cycles-model-arena';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import type { TraceContext } from '@pkgs/quint-shared-ts/registry';
import { setQuintWorld } from '@pkgs/quint-shared-ts/registry';

export type LightCyclesTraceWorld = {
  readonly ctx: TraceContext;
  arena: Run<ModelArena> | null;
};

export function traceArena(w: LightCyclesTraceWorld): Run<ModelArena> {
  if (w.arena === null)
    throw new Error('no arena — the binding init opens one');
  return w.arena;
}

export function useLightCyclesTraceWorld(): void {
  setQuintWorld<LightCyclesTraceWorld>({
    create: async (ctx) => ({ ctx, arena: null }),
    dispose: async (w) => {
      await w.arena?.[Symbol.asyncDispose]();
    },
  });
}
