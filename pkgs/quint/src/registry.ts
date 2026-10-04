/**
 * How a package runs its Quint models against the product: one world (what a
 * trace runs in — for product models, a harness) and one binding per model (what
 * each Quint action does in that world, and how to read the model's state
 * back out of it). Module-global, like the Gherkin registry, filled by the
 * `tests/quint/**` modules a package's quint entry imports.
 */

import type { QuintValue } from './itf';

export type TraceContext = {
  readonly packageName: string;
  /** Repo-relative model path (`specs/spaces/space-hosting.qnt`). */
  readonly specUri: string;
  /** The model: the `.qnt` file's stem. */
  readonly model: string;
  /** 1-based. */
  readonly trace: number;
  readonly seed: string;
  /** Stable id for the trace (`<model>.trace-<n>`). */
  readonly testId: string;
  readonly title: string;
};

/** One trace step as the world's report shows it. */
export type TraceStepMeta = {
  readonly title: string;
  readonly detail: string;
};

export type QuintWorld<W> = {
  readonly create: (ctx: TraceContext) => Promise<W>;
  readonly dispose: (world: W) => Promise<void>;
  /**
   * Give the product time to reach the model's state: re-check `matches` on
   * the world's own clock until it holds or the world's patience runs out.
   * Without it, the state is compared once, right after the action.
   */
  readonly settle?: (
    world: W,
    matches: () => Promise<boolean>
  ) => Promise<void>;
  /** Run one trace step as a labelled step of the world's report. */
  readonly record?: <T>(
    world: W,
    meta: TraceStepMeta,
    fn: () => Promise<T>
  ) => Promise<T>;
  /** Calls the world made so far (e.g. harness calls), newest last. */
  readonly calls?: (world: W) => readonly string[];
};

/** The values the action drew (`nondet` names → values). */
export type Picks = Readonly<Record<string, QuintValue>>;

export type QuintBinding<W> = {
  /** The model this binds: its `.qnt` file's stem (`space-hosting`). */
  readonly model: string;
  /** Traces to draw. Default {@link DEFAULT_TRACES}. */
  readonly traces?: number;
  /** Steps after `init`, at most. Default {@link DEFAULT_MAX_STEPS}. */
  readonly maxSteps?: number;
  /**
   * Steps after `init` Apalache explores when it model-checks every
   * invariant. Default {@link DEFAULT_VERIFY_STEPS}. The check is exhaustive
   * up to the bound, so its cost grows steeply with it — with the number of
   * actions and the sizes of the sets they draw from: at 4 steps most
   * product models check in 4–35 s, but one with ~35 transitions took 7 s at
   * 2 steps, 39 s at 3 and over 10 minutes at 4. Lower it for such a model
   * (the check is killed after 240 s); raise it where a violation needs a
   * longer run to show. The package's models check (`check:models`) reads it
   * from the binding's text, so write it as a number literal.
   */
  readonly verifySteps?: number;
  /** Candidate proved by induction, instead of stopping at a sequence bound. */
  readonly inductiveInvariant?: string;
  /** Opt into independent solver phases for the same induction obligations. */
  readonly separateInduction?: boolean;
  /**
   * The models check's deadline for this model, in milliseconds. Default
   * {@link DEFAULT_VERIFY_TIMEOUT_MS}. Raise it only for a proof whose cost
   * is expected; a timeout remains a failed obligation. Read from the
   * binding's text, so write it as a number literal.
   */
  readonly verifyTimeoutMs?: number;
  /** Opt into Apalache's array encoding without changing proof obligations. */
  readonly encoding?: 'fun-arrays';
  /** Per-trace test timeout. Default: the runner's. */
  readonly timeoutMs?: number;
  /** Literal histories retained after a failing model trace found a defect. */
  readonly regressions?: readonly {
    readonly id: string;
    readonly title: string;
    readonly seed: string;
    /** The original ITF input, decoded by the runner. */
    readonly itf: unknown;
  }[];
  /**
   * One entry per Quint action the model can take, `init` included. Each does
   * in the world what the action does in the model, with the values it drew.
   */
  readonly actions: Readonly<
    Record<string, (world: W, picks: Picks) => Promise<void>>
  >;
  /**
   * The model's state, read from the world. Read every public variable;
   * only private variables whose names begin with `_` may be left out.
   */
  readonly observe: (world: W) => Promise<Readonly<Record<string, QuintValue>>>;
  /**
   * The world's whole end state as one string (state hashes, say), finer
   * than {@link observe}. When given, the runner replays the longest trace
   * twice, each in a fresh world, and requires the same fingerprint: a run
   * is a function of its seed and the trace.
   */
  readonly fingerprint?: (world: W) => Promise<string>;
};

export const DEFAULT_TRACES = 4;
export const DEFAULT_MAX_STEPS = 10;
export const DEFAULT_VERIFY_STEPS = 4;
export const DEFAULT_VERIFY_TIMEOUT_MS = 240_000;

type Registry = {
  world: QuintWorld<unknown> | null;
  readonly bindings: Map<string, QuintBinding<unknown>>;
};

const REGISTRY_KEY = Symbol.for('quint.registry');

function registry(): Registry {
  const host = globalThis as { [REGISTRY_KEY]?: Registry };
  host[REGISTRY_KEY] ??= { world: null, bindings: new Map() };
  return host[REGISTRY_KEY];
}

export function setQuintWorld<W>(world: QuintWorld<W>): void {
  registry().world = world as QuintWorld<unknown>;
}

export function quintWorld(): QuintWorld<unknown> {
  const world = registry().world;
  if (world === null) {
    throw new Error(
      'quint: no world registered — the package quint entry (tests/quint/index.ts) must call setQuintWorld (for harnesses: useQuintHarness)'
    );
  }
  return world;
}

export function bindQuintModel<W>(binding: QuintBinding<W>): void {
  const bindings = registry().bindings;
  if (bindings.has(binding.model)) {
    throw new Error(`quint: model ${binding.model} is bound twice`);
  }
  bindings.set(binding.model, binding as QuintBinding<unknown>);
}

export function quintBinding(model: string): QuintBinding<unknown> {
  const binding = registry().bindings.get(model);
  if (binding === undefined) {
    throw new Error(
      `quint: model ${model} has no binding — add bindQuintModel({ model: '${model}', … }) under tests/quint/ and import it from tests/quint/index.ts`
    );
  }
  return binding;
}
