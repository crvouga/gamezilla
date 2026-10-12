/**
 * Which drawn traces a run replays through the product.
 *
 * Drawing is cheap and replaying is not: a trace costs a fresh world and one
 * whole-product step per action. Every run draws every trace, so the model's
 * invariants and its action coverage are judged on the full draw, and replays
 * only this selection:
 *
 * 1. a cover — traces that between them take every bound action the draw
 *    takes, so no binding goes unexercised against the product;
 * 2. then the earliest-drawn traces, until the budget is spent.
 *
 * The gate's budget is the cover alone: bounded, the same traces every run.
 * Replaying the rest is exploration, which a run asks for by name.
 *
 * The selection is a function of the draw and the budget alone, so the same
 * code selects the same traces on every machine and in every slice.
 */

import type { ItfTrace } from './itf';

function actionsOf(trace: ItfTrace, bound: ReadonlySet<string>): Set<string> {
  return new Set(
    trace.states.map((state) => state.action).filter((name) => bound.has(name))
  );
}

/**
 * The smallest-first greedy cover: the trace taking the most actions not yet
 * covered, the shorter one on a tie, the earlier-drawn on a further tie.
 */
function cover(
  traces: readonly ItfTrace[],
  bound: ReadonlySet<string>
): readonly number[] {
  const taken = traces.map((trace) => actionsOf(trace, bound));
  const covered = new Set<string>();
  const chosen: number[] = [];
  for (;;) {
    let best = -1;
    let bestGain = 0;
    for (const [index, actions] of taken.entries()) {
      let gain = 0;
      for (const action of actions) if (!covered.has(action)) gain++;
      const shorter =
        best >= 0 && traces[index]!.states.length < traces[best]!.states.length;
      if (gain > bestGain || (gain === bestGain && gain > 0 && shorter)) {
        best = index;
        bestGain = gain;
      }
    }
    if (best < 0) return chosen;
    chosen.push(best);
    for (const action of taken[best]!) covered.add(action);
  }
}

/**
 * The 0-based positions, in draw order, of the traces to replay. An infinite
 * budget replays every trace. A cover larger than the budget is kept whole:
 * the budget bounds exploration, never the bindings exercised.
 */
export function replaySelection(
  traces: readonly ItfTrace[],
  boundActions: readonly string[],
  budget: number
): ReadonlySet<number> {
  if (budget === Number.POSITIVE_INFINITY) return new Set(traces.keys());
  if (!Number.isSafeInteger(budget) || budget < 1) {
    throw new Error('quint: a replay budget is a whole number of traces');
  }
  const selected = new Set(cover(traces, new Set(boundActions)));
  for (const index of traces.keys()) {
    if (selected.size >= budget) break;
    selected.add(index);
  }
  return selected;
}
