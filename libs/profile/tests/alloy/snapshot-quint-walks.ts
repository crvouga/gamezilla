// @io-wall-ok — draws Quint traces (a child process writing trace files under the report dir named by the spec runner's env).
/**
 * Scenarios drawn by a Quint model instead of written by hand: Quint draws a
 * few traces of the model (seeded like every model run, `FC_SEED`), each is
 * walked through the model's own Quint binding (the same harness actions its
 * trace tests take), and every store is read after every step — so the
 * structure audits every state a trace passes through, not only its end.
 *
 * Before the next step, the walk gives the product the time the model's own
 * run gives it to reach the state the model is in; whether it does is the
 * Quint test's verdict, not this one's, so a walk goes on either way.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import { type ItfState, type ItfTrace, quintEqual } from '@pkgs/quint/itf';
import { type QuintBinding, quintBinding } from '@pkgs/quint/registry';
import { describeStep } from '@pkgs/quint/replay';
import { simulate } from '@pkgs/quint/simulate';

import type { Scenario } from './snapshot-worlds';

/** How long a step may take to land, as the model's own run allows. */
const SETTLE_MS = 15_000;

export type QuintWalks = {
  readonly packageName: string;
  /** Repo-relative model path (`specs/friends/friendship.qnt`). */
  readonly specUri: string;
  /** Traces to draw, and steps after `init` in each, at most. */
  readonly traces: number;
  readonly maxSteps: number;
};

const REPO_ROOT = join(import.meta.dir, '../../../..');

function modelOf(specUri: string): string {
  return (specUri.split('/').pop() ?? specUri).replace(/\.qnt$/, '');
}

async function settle(
  w: QuintHarnessWorld,
  binding: QuintBinding<unknown>,
  state: ItfState
): Promise<void> {
  const reached = async () => {
    const seen = await binding.observe(w);
    return Object.entries(seen).every(([name, value]) => {
      const want = state.vars[name];
      return want !== undefined && quintEqual(want, value);
    });
  };
  await w.quiet
    .until(reached, { pred: (ok) => ok, maxMs: SETTLE_MS })
    .catch(() => undefined);
}

function walk(
  walks: QuintWalks,
  trace: ItfTrace,
  index: number,
  seed: string
): Scenario {
  const model = modelOf(walks.specUri);
  const title = `${model} trace ${String(index + 1)}`;
  return {
    name: `the ${title} drawn by Quint`,
    run: async (s, capture) => {
      const binding = quintBinding(model);
      const ctx = {
        packageName: walks.packageName,
        specUri: walks.specUri,
        model,
        trace: index + 1,
        seed,
        testId: `alloy.${model}.trace-${String(index + 1)}`,
        title,
      };
      const w: QuintHarnessWorld = {
        s,
        quiet: s,
        ctx,
        memo: new Map(),
        calls: [],
      };
      for (const [step, state] of trace.states.entries()) {
        const act = binding.actions[state.action];
        if (act === undefined) {
          throw new Error(`${model} has no binding for ${state.action}`);
        }
        await act(w, state.picks);
        await settle(w, binding, state);
        // The last step's state is read as the scenario's end.
        if (step < trace.states.length - 1) {
          await capture(`step ${String(step)}: ${describeStep(state)}`);
        }
      }
    },
  };
}

/** A scenario per trace Quint draws from the model. */
export function quintWalks(walks: QuintWalks): readonly Scenario[] {
  const model = modelOf(walks.specUri);
  const drawn = simulate({
    specPath: join(REPO_ROOT, walks.specUri),
    traces: walks.traces,
    maxSteps: walks.maxSteps,
    outDir: join(
      process.env['HARNESS_REPORT_DIR'] ?? tmpdir(),
      'alloy',
      'quint-walks',
      model
    ),
  });
  return drawn.traces.map((trace, i) => walk(walks, trace, i, drawn.seed));
}
