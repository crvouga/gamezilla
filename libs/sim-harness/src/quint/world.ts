/**
 * The world a product Quint model's traces run in: one sim per trace, opened
 * before `init` and disposed after the last step, like a Gherkin scenario's
 * (`../spec/world.ts`). Each trace step is one labelled report step holding
 * the sim calls it made, and the model's state is read back on the sim's
 * virtual clock, so a product that converges asynchronously (a push landing
 * on another device) is given the time a person would give it.
 *
 *   // tests/quint/index.ts
 *   import './space-hosting.quint';
 *   import { useQuintSim } from '@libs/sim-harness/quint/world';
 *   import { openSim } from '../e2e/support/open-friends-sim';
 *   useQuintSim(openSim);
 */

import { setQuintWorld, type TraceContext } from '@pkgs/quint/registry';

import type { OpenSim } from '../open-sim/open-sim';
import { type OpenPackageSim, recordingRun } from '../spec/world';

export type QuintSimWorld = {
  /** The run. A binding's actions call `s.apply` / `s.read` on it. */
  readonly s: OpenSim;
  /**
   * The same run, unrecorded: what `observe` reads through, so a failure's
   * "world calls during the step" lists what the step did, not every probe
   * of the state that followed.
   */
  readonly quiet: OpenSim;
  readonly ctx: TraceContext;
  /** Values an action hands to a later one (a space link, an account id). */
  readonly memo: Map<string, unknown>;
  readonly calls: string[];
};

/** How long the product may take to reach the model's state after a step. */
const SETTLE_MS = 15_000;
const SETTLE_STEP_MS = 100;

export function useQuintSim(openSim: OpenPackageSim): void {
  setQuintWorld<QuintSimWorld>({
    create: async (ctx) => {
      const calls: string[] = [];
      const opened = await openSim(ctx.testId, {
        report: { title: ctx.title, sourceFile: ctx.specUri },
      });
      return {
        s: recordingRun(opened, calls),
        quiet: opened,
        ctx,
        memo: new Map(),
        calls,
      };
    },
    dispose: (w) => w.quiet[Symbol.asyncDispose](),
    calls: (w) => w.calls,
    record: (w, meta, fn) =>
      w.s.record({ kind: 'quint', title: meta.title, detail: meta.detail }, fn),
    settle: async (w, matches) => {
      try {
        await w.quiet.until(() => matches(), {
          maxMs: SETTLE_MS,
          stepMs: SETTLE_STEP_MS,
        });
      } catch {
        // Still apart: the bridge reads the state once more and reports the
        // difference, which says more than "until timed out".
      }
    },
  });
}
