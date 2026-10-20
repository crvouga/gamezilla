/**
 * The runs of one model trace: once, or — when the host varies the model
 * (`defineTraceVariants`) — once per variant, each named for it so its test,
 * world and verdict are its own.
 */

import type { ItfTrace } from '@pkgs/quint-shared/itf';
import type {
  ModelParameters,
  TraceContext,
  TraceVariant,
} from '@pkgs/quint-shared/registry';
import { replayCover, replaySelection } from '@pkgs/quint-shared/replay-budget';
import { DEFAULT_REPLAY_TRACES } from '@pkgs/quint-shared/wall';

/** One run of a trace: the only one, or the one for a variant of the model. */
export type TraceRun = { readonly variant?: TraceVariant };
export const ONCE: readonly TraceRun[] = [{}];

/** `ctx` for `run`: its test id and title name the variant. */
export function runContext(ctx: TraceContext, run: TraceRun): TraceContext {
  const variant = run.variant;
  if (variant === undefined) return ctx;
  return {
    ...ctx,
    variant,
    testId: `${ctx.testId}.${variant.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    title: `${ctx.title} [${variant.label}]`,
  };
}

/** A test name for `run`, naming its variant. */
export function runName(name: string, run: TraceRun): string {
  return run.variant === undefined ? name : `${name} [${run.variant.label}]`;
}

/** An obligation id for `run` (`trace:3 [chess]`), so each variant has its own. */
export function runObligation(id: string, run: TraceRun): string {
  return run.variant === undefined ? id : `${id} [${run.variant.id}]`;
}

/**
 * The runs trace `i` (0-based) is replayed for: every run when the trace is
 * in the cover (so each variant takes every bound action) or the model is
 * not varied; otherwise one, the variants taking the rest in turn.
 */
export function runsOfTrace(
  i: number,
  runs: readonly TraceRun[],
  cover: ReadonlySet<number>
): readonly TraceRun[] {
  return runs.length <= 1 || cover.has(i) ? runs : [runs[i % runs.length]!];
}

/** One of the files a model's tests are spread over (`index` of `count`). */
export type TraceSlice = { readonly index: number; readonly count: number };

/**
 * Whether run `run` (0-based, of `runCount`) of the model's `test`-th test
 * (0-based: its traces, then its pinned histories) belongs to `slice`. A
 * varied model's runs are dealt out among the slices one by one, so each
 * slice holds about its share of every run rather than every run of its
 * own tests; an unvaried model's tests are sliced as they always were.
 */
export function runInSlice(
  test: number,
  run: number,
  runCount: number,
  slice: TraceSlice
): boolean {
  return (test * runCount + run) % slice.count === slice.index;
}

/**
 * What one model's tests replay through the product on the pinned seed: the
 * plan a package commits (`tests/quint/replays.json`) so its spec parts are
 * sized by the replays that run, not by the draw. The model's run checks the
 * plan against its own draw (`runQuintModel`'s `replayPlan`).
 */
export type ReplayPlan =
  | ReplayDrawPlan
  | {
      readonly seed: string;
      readonly instances: readonly {
        readonly parameters: ModelParameters;
        readonly plan: ReplayDrawPlan;
      }[];
    };

export type ReplayDrawPlan = {
  /** The draw the plan describes; another seed's run does not check it. */
  readonly seed: string;
  /** Traces drawn. */
  readonly traces: number;
  /** 0-based positions every variant replays: the bound-action cover. */
  readonly cover: readonly number[];
  /** 0-based positions the bounded gate replays (`QUINT_REPLAY_TRACES` unset). */
  readonly replayed: readonly number[];
  /** Pinned histories, each replayed for every variant. */
  readonly regressions: number;
  /** Whether each variant replays its longest trace twice (a fingerprint). */
  readonly determinism: boolean;
  /** Runs of the model: one, or one per variant. */
  readonly variants: number;
};

/** The pull-request gate replays the plan's selection; nightly every trace. */
export type ReplayProfile = 'pr' | 'nightly';

/**
 * Trace replays the model's `slice` registers under `profile`, dealt exactly
 * as `runQuintModel` deals them ({@link runsOfTrace}, {@link runInSlice});
 * a determinism check replays its trace twice, so it counts two.
 */
export function sliceReplays(
  plan: ReplayPlan,
  profile: ReplayProfile,
  slice: TraceSlice
): number {
  if ('instances' in plan)
    return plan.instances.reduce(
      (count, instance) => count + sliceReplays(instance.plan, profile, slice),
      0
    );
  const runs: readonly TraceRun[] =
    plan.variants <= 1
      ? ONCE
      : Array.from({ length: plan.variants }, (_, index) => ({
          variant: { id: String(index), label: String(index) },
        }));
  const mine = (test: number, run: TraceRun): boolean =>
    runInSlice(test, runs.indexOf(run), runs.length, slice);
  return (
    tracesInSlice(plan, profile, runs, mine) +
    historiesInSlice(plan, runs, mine) +
    determinismInSlice(plan, runs, mine, slice)
  );
}

type Mine = (test: number, run: TraceRun) => boolean;

function tracesInSlice(
  plan: ReplayDrawPlan,
  profile: ReplayProfile,
  runs: readonly TraceRun[],
  mine: Mine
): number {
  const cover = new Set(plan.cover);
  const replayed = new Set(plan.replayed);
  let count = 0;
  for (let i = 0; i < plan.traces; i++) {
    if (profile === 'pr' && !replayed.has(i)) continue;
    count += runsOfTrace(i, runs, cover).filter((run) => mine(i, run)).length;
  }
  return count;
}

function historiesInSlice(
  plan: ReplayDrawPlan,
  runs: readonly TraceRun[],
  mine: Mine
): number {
  let count = 0;
  for (let i = 0; i < plan.regressions; i++)
    count += runs.filter((run) => mine(plan.traces + i, run)).length;
  return count;
}

/** An unvaried model checks determinism in slice 0; a varied one deals it out. */
function determinismInSlice(
  plan: ReplayDrawPlan,
  runs: readonly TraceRun[],
  mine: Mine,
  slice: TraceSlice
): number {
  if (!plan.determinism || plan.traces === 0) return 0;
  if (runs.length <= 1) return slice.index === 0 ? 2 : 0;
  const test = plan.traces + plan.regressions;
  return 2 * runs.filter((run) => mine(test, run)).length;
}

/**
 * The model's {@link ReplayPlan} on this draw: what the bounded gate replays
 * and for how many runs.
 */
export function replayPlanOf(
  drawn: { readonly seed: string; readonly traces: readonly ItfTrace[] },
  binding: {
    readonly actions: Readonly<Record<string, unknown>>;
    readonly regressions?: readonly unknown[] | undefined;
    readonly fingerprint?: unknown;
  },
  runs: readonly TraceRun[]
): ReplayDrawPlan {
  const actions = Object.keys(binding.actions);
  const sorted = (positions: ReadonlySet<number>) =>
    [...positions].sort((a, b) => a - b);
  return {
    seed: drawn.seed,
    traces: drawn.traces.length,
    cover: sorted(replayCover(drawn.traces, actions)),
    replayed: sorted(
      replaySelection(drawn.traces, actions, DEFAULT_REPLAY_TRACES)
    ),
    regressions: binding.regressions?.length ?? 0,
    determinism: binding.fingerprint !== undefined,
    variants: runs.length,
  };
}
