/**
 * Evaluate one objective of an SLO against a measurement of its indicator —
 * the pure comparison the bun-test bridge runs, exported so a product can
 * seed faults (degraded latency, an error burst) and see the objective fail.
 *
 * - A ratio indicator is measured as events (`good` or not); a threshold
 *   indicator as samples, each good when `value <op> objective.value`
 *   (p95 latency < 200 ms ⇔ ≥ 95 % of samples < 200).
 * - Only events inside the SLO's window at `nowMs` count (both ends
 *   inclusive, see `window`).
 * - Occurrences: good / total ≥ target.
 * - Timeslices: events bucket into `timeSliceWindow` slices from the window
 *   start; a slice with events is good when its own ratio ≥
 *   `timeSliceTarget`; good slices / slices ≥ target. Empty slices count
 *   neither way.
 * - No events in the window is no evidence: not met.
 */

import type { Objective, Operator, Sli, Slo } from './model';
import type { WindowBounds } from './window';
import { parseDuration, windowBounds, withinBounds } from './window';

export type Measurement =
  | {
      readonly kind: 'events';
      readonly events: readonly {
        readonly atMs: number;
        readonly good: boolean;
      }[];
    }
  | {
      readonly kind: 'samples';
      readonly samples: readonly {
        readonly atMs: number;
        readonly value: number;
      }[];
    };

export type Evaluation = {
  readonly met: boolean;
  /** good / total (or good slices / slices); `null` when nothing was observed. */
  readonly observed: number | null;
  /** The objective's target as a fraction. */
  readonly target: number;
  /** Events or samples inside the window. */
  readonly considered: number;
  readonly detail: string;
};

export type EvaluateInput = {
  readonly slo: Slo;
  readonly sli: Sli;
  readonly objective: Objective;
  readonly measurement: Measurement;
  readonly nowMs: number;
};

/** Ratios within this of a target reach it (so `99.9 / 100` is met by 999/1000). */
const EPSILON = 1e-9;

type Outcome = { readonly atMs: number; readonly good: boolean };

export function compare(op: Operator, left: number, right: number): boolean {
  switch (op) {
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
  }
}

export function evaluateObjective(input: EvaluateInput): Evaluation {
  const { objective } = input;
  const outcomes = toOutcomes(input);
  if (typeof outcomes === 'string') {
    return notMet(objective, 0, outcomes);
  }
  const bounds = windowBounds(input.slo, input.nowMs);
  const inWindow = outcomes.filter((o) => withinBounds(o.atMs, bounds));
  const span = describeBounds(bounds);
  if (inWindow.length === 0) {
    return notMet(
      objective,
      0,
      `no evidence: no ${unitOf(input.sli)} in the window ${span}`
    );
  }
  const counted =
    input.slo.budgetingMethod === 'Timeslices'
      ? countSlices(inWindow, objective, bounds)
      : countOccurrences(inWindow, goodWhen(input));
  const observed = counted.good / counted.total;
  const met = observed + EPSILON >= objective.target;
  return {
    met,
    observed,
    target: objective.target,
    considered: inWindow.length,
    detail: `observed ${formatRatio(observed)} (${counted.label}) vs target ${formatRatio(objective.target)} over ${span}: ${met ? 'met' : 'not met'}`,
  };
}

function toOutcomes(input: EvaluateInput): readonly Outcome[] | string {
  const { sli, objective, measurement } = input;
  if (sli.metric.kind === 'ratio') {
    if (measurement.kind !== 'events') {
      return `SLI ${sli.name} is a ratio indicator and is measured as events, but the measure returned ${measurement.kind}`;
    }
    return measurement.events;
  }
  if (measurement.kind !== 'samples') {
    return `SLI ${sli.name} is a threshold indicator and is measured as samples, but the measure returned ${measurement.kind}`;
  }
  const { op, value } = objective;
  if (op === null || value === null) {
    return `objective "${objective.displayName}" on threshold SLI ${sli.name} has no op and value`;
  }
  return measurement.samples.map((sample) => ({
    atMs: sample.atMs,
    good: compare(op, sample.value, value),
  }));
}

function countOccurrences(
  outcomes: readonly Outcome[],
  unit: string
): { readonly good: number; readonly total: number; readonly label: string } {
  const good = outcomes.filter((o) => o.good).length;
  return {
    good,
    total: outcomes.length,
    label: `${String(good)}/${String(outcomes.length)} ${unit}`,
  };
}

/** `good events`, or `samples lt 200` for a threshold. */
function goodWhen(input: EvaluateInput): string {
  const { op, value } = input.objective;
  return input.sli.metric.kind === 'ratio' || op === null || value === null
    ? 'good events'
    : `samples ${op} ${String(value)}`;
}

function countSlices(
  outcomes: readonly Outcome[],
  objective: Objective,
  bounds: WindowBounds
): { readonly good: number; readonly total: number; readonly label: string } {
  const sliceMs = parseDuration(objective.timeSliceWindow ?? '');
  const sliceTarget = objective.timeSliceTarget;
  if (sliceMs === null || sliceTarget === null) {
    throw new Error(
      `openslo: Timeslices objective "${objective.displayName}" has no timeSliceWindow/timeSliceTarget`
    );
  }
  const slices = new Map<number, { good: number; total: number }>();
  for (const outcome of outcomes) {
    const index = Math.floor((outcome.atMs - bounds.startMs) / sliceMs);
    const slice = slices.get(index) ?? { good: 0, total: 0 };
    slice.total += 1;
    if (outcome.good) slice.good += 1;
    slices.set(index, slice);
  }
  const good = [...slices.values()].filter(
    (slice) => slice.good / slice.total + EPSILON >= sliceTarget
  ).length;
  return {
    good,
    total: slices.size,
    label: `${String(good)}/${String(slices.size)} good ${objective.timeSliceWindow ?? ''} slices at ${formatRatio(sliceTarget)}, ${String(outcomes.length)} events`,
  };
}

function notMet(
  objective: Objective,
  considered: number,
  detail: string
): Evaluation {
  return {
    met: false,
    observed: null,
    target: objective.target,
    considered,
    detail,
  };
}

function unitOf(sli: Sli): string {
  return sli.metric.kind === 'ratio' ? 'events' : 'samples';
}

function formatRatio(ratio: number): string {
  return String(Number(ratio.toPrecision(6)));
}

function describeBounds(bounds: WindowBounds): string {
  return `[${isoOf(bounds.startMs)}, ${isoOf(bounds.endMs)}]`;
}

function isoOf(ms: number): string {
  return Number.isFinite(ms) && Math.abs(ms) <= 8.64e15
    ? new Date(ms).toISOString()
    : String(ms);
}
