import type { Rng } from '../internals/rng';
import type { RunReporter } from '../report/reporter';
import type { RecordStepMeta, RunReport } from '../report/types';
import type { Session } from '../runtime/types';
import type { Action, Property, Read } from '../system/effect';
import type { Step } from '../system/recording';
import type { ActionSlice, SystemCore as System } from '../system/registry';
import type { MonitorState, Transition } from './checkpoint';

export type RandomActionsOptions<S> = {
  /**
   * Slice of the walk: registered action names and/or action objects.
   * Default: system actions with `pool !== false`.
   */
  readonly actions?: ActionSlice<S>;
  readonly steps?: number;
  readonly budgetMs?: number;
  readonly stopOnViolation?: boolean;
  readonly time?: {
    readonly weight: number;
    readonly minMs: number;
    readonly maxMs: number;
  };
};

export type RandomActionsReport = {
  /** Number of actions executed. */
  readonly count: number;
  /** Recorded steps (action + args). */
  readonly steps: readonly Step[];
  readonly transitions: readonly Transition[];
  readonly args: unknown;
  readonly coverage: {
    readonly states: ReadonlySet<string>;
    readonly actions: Readonly<Record<string, number>>;
  };
  readonly violations: readonly { readonly error: string }[];
};

/** Rest args: full override, or empty to use `action.args` defaults. */
type ApplyRest<A extends unknown[]> = A | [];

export type Run<S> = {
  /**
   * `A` is inferred from the action alone (`NoInfer` on the rest), so
   * `s.apply(auth, 'c0', 'revoked')` checks the literal against the
   * action's declared union instead of widening it to `string`.
   */
  readonly apply: <A extends unknown[]>(
    action: Action<S, A>,
    ...args: NoInfer<ApplyRest<A>>
  ) => Promise<void>;
  readonly read: <T, A extends unknown[]>(
    read: Read<S, A, T>,
    ...args: A
  ) => Promise<T>;
  readonly assert: (p: Property<S>) => Promise<void>;
  readonly advanceTime: (ms: number) => Promise<void>;
  readonly until: <T>(
    read: Read<S, [], T>,
    opts?: {
      readonly maxMs?: number;
      readonly stepMs?: number;
      readonly pred?: (t: T) => boolean;
    }
  ) => Promise<T>;
  readonly never: <T>(
    read: Read<S, [], T>,
    opts: {
      readonly forMs: number;
      readonly stepMs?: number;
      readonly pred?: (t: T) => boolean;
    }
  ) => Promise<void>;
  readonly randomActions: (
    opts?: RandomActionsOptions<S>
  ) => Promise<RandomActionsReport>;
  /**
   * Open one labeled report step, run `fn`, capture snapshots after
   * (or before when `snapshotBefore`). Nested `apply` / `advanceTime`
   * attach frames to this step instead of minting new ones.
   */
  readonly record: <T>(
    meta: RecordStepMeta,
    fn: () => Promise<T>
  ) => Promise<T>;
  /** Capture registered snapshotters onto the current/open step. */
  readonly snapshot: () => Promise<void>;
  /**
   * Mark the run failed for a failure raised outside any step (e.g. a test
   * body assertion). No-op when reporting is disabled.
   */
  readonly fail: (cause: unknown) => void;
  /** In-memory report so far (empty when reporting is disabled). */
  readonly report: () => RunReport | null;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/** Module-private run state — randomActions / explore / replay only. */
export type RunInternal<S> = {
  readonly surface: S;
  readonly session: Session;
  readonly system: System<S, unknown>;
  readonly systemName: string;
  readonly args: unknown;
  readonly runtimeName: string;
  readonly monitors: MonitorState[];
  readonly transitions: Transition[];
  readonly steps: Step[];
  readonly reporter: RunReporter | null;
  rng: Rng;
  step: number;
};

const runInternals = new WeakMap<object, RunInternal<unknown>>();

export function setRunInternal<S>(s: Run<S>, internal: RunInternal<S>): void {
  runInternals.set(s as object, internal as RunInternal<unknown>);
}

/** Package-internal accessor — not part of the public `Run` surface. */
export function getRunInternal<S>(s: Run<S>): RunInternal<S> {
  const internal = runInternals.get(s as object);
  if (internal === undefined) {
    throw new Error('getRunInternal: run is not registered');
  }
  return internal as RunInternal<S>;
}
