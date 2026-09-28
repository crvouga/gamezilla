// @io-wall-ok — draws Quint traces (a child process writing trace files under the report dir named by the spec runner's env).
/**
 * A scenario drawn by a Quint model instead of written by hand: Quint draws a
 * few dozen candidate traces of the model (seeded like every model run,
 * `FC_SEED`; one Quint run), the one that stresses the structure most (the
 * binding's score) is walked through the model's
 * own Quint binding (the same harness actions its trace tests take), and
 * every store is read after every step — so the structure audits every state
 * the trace passes through, not only its end.
 *
 * Before the next step, the walk gives the product the time the model's own
 * run gives it to reach the state the model is in; whether it does is the
 * Quint test's verdict, not this one's, so a walk goes on either way.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type ItfState, type ItfTrace, quintEqual } from '@pkgs/quint/itf';
import { type QuintBinding, quintBinding } from '@pkgs/quint/registry';
import { describeStep } from '@pkgs/quint/replay';
import { simulate } from '@pkgs/quint/simulate';

import type { QuintHarnessWorld } from '../quint/world';
import type { Scenario } from './snapshot-worlds';

/** How long a step may take to land, as the model's own run allows. */
const SETTLE_MS = 15_000;
/** Drawing is one Quint run whatever the count (about 0.4 s), so draw plenty. */
const DEFAULT_CANDIDATES = 64;

export type QuintWalk = {
  readonly packageName: string;
  /** Repo-relative model path (`specs/friends/friendship.qnt`). */
  readonly specUri: string;
  /** Steps after `init`, at most. */
  readonly maxSteps: number;
  /** Traces drawn to choose from. Default {@link DEFAULT_CANDIDATES}. */
  readonly candidates?: number;
  /**
   * How much a trace stresses the structure (higher is better): the walk
   * takes the best-scoring candidate. Default: {@link distinctActions}.
   */
  readonly score?: (trace: ItfTrace) => number;
};

/** How many of the model's actions a trace takes. */
export function distinctActions(trace: ItfTrace): number {
  return new Set(trace.states.map((state) => state.action)).size;
}

/** How many of `actions` a trace takes. */
export function reaches(trace: ItfTrace, actions: readonly string[]): number {
  const taken = new Set(trace.states.map((state) => state.action));
  return actions.filter((action) => taken.has(action)).length;
}

const REPO_ROOT = join(import.meta.dir, '../../../..');

function modelOf(specUri: string): string {
  return (specUri.split('/').pop() ?? specUri).replace(/\.qnt$/, '');
}

/** The best-scoring trace (the first such, in draw order). */
function best(
  traces: readonly ItfTrace[],
  score: (trace: ItfTrace) => number
): ItfTrace {
  const [first, ...rest] = traces;
  if (first === undefined) throw new Error('quint drew no traces');
  return rest.reduce((top, t) => (score(t) > score(top) ? t : top), first);
}

function draw(walk: QuintWalk): { trace: ItfTrace; seed: string } {
  const drawn = simulate({
    specPath: join(REPO_ROOT, walk.specUri),
    traces: walk.candidates ?? DEFAULT_CANDIDATES,
    maxSteps: walk.maxSteps,
    outDir: join(
      process.env['HARNESS_REPORT_DIR'] ?? tmpdir(),
      'alloy',
      'quint-walks',
      modelOf(walk.specUri)
    ),
  });
  return {
    trace: best(drawn.traces, walk.score ?? distinctActions),
    seed: drawn.seed,
  };
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

/** One scenario: the best-scoring of the traces Quint draws from the model. */
export function quintWalk(walk: QuintWalk): Scenario {
  const model = modelOf(walk.specUri);
  return {
    name: `a ${model} trace drawn by Quint`,
    run: async (s, capture) => {
      const binding = quintBinding(model);
      const { trace, seed } = draw(walk);
      const ctx = {
        packageName: walk.packageName,
        specUri: walk.specUri,
        model,
        trace: 1,
        seed,
        testId: `alloy.${model}.walk`,
        title: `${model} walk`,
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
