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
  /** Per-trace test timeout. Default: the runner's. */
  readonly timeoutMs?: number;
  /**
   * One entry per Quint action the model can take, `init` included. Each does
   * in the world what the action does in the model, with the values it drew.
   */
  readonly actions: Readonly<
    Record<string, (world: W, picks: Picks) => Promise<void>>
  >;
  /**
   * The model's state, read from the world. Every key is a model variable;
   * the variables it leaves out are the model's own bookkeeping.
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
