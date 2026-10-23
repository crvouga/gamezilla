/**
 * Run a Quint model under `bun test`: one `describe` per model with, before
 * any trace reaches the product, a test that the model type checks; then one
 * `test` per trace Quint draws from it, one that
 * fails when the traces never take a bound action, and (with a fingerprint)
 * one that a trace replayed twice ends the same. A host that varies the model
 * (`defineTraceVariants`: one variant per game it holds for, say) replays it
 * per variant, each run its own test in a fresh world named `[<label>]`
 * with its own verdict: every variant replays the traces that take every
 * bound action, its regressions and the determinism check, and the rest of
 * an exploring run's traces are dealt out among the variants in turn. Every trace is drawn and
 * judged; the ones replayed are the selection of
 * `@pkgs/quint-shared-ts/replay-budget` — by default the fewest that take every
 * bound action, and all of them when the run explores
 * (`QUINT_REPLAY_TRACES=all`). Every decided obligation is recorded as
 * evidence in the report bucket (`./model-evidence`). The
 * runner-generated stub (`.cache/spec/<name>.qnt.test.ts`) imports the
 * package's quint entry (which registers the world and the bindings) and
 * calls {@link runQuintModel}.
 */

import { describe, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type {
  QuintBinding,
  TraceContext,
} from '@pkgs/quint-shared-ts/registry';
import { quintBinding, quintWorld } from '@pkgs/quint-shared-ts/registry';
import {
  describeStep,
  replayTrace,
  replayTraceTwice,
  untakenActions,
} from '@pkgs/quint-shared-ts/replay';
import {
  replayCover,
  replaySelection,
} from '@pkgs/quint-shared-ts/replay-budget';
import { modelShapeIssues } from '@pkgs/quint-shared-ts/shape';
import { formatModelShapeIssue } from '@pkgs/quint-shared-ts/shape-model';
import { quintReplayBudget } from '@pkgs/quint-shared-ts/wall';
import { registerModelChecks } from './model-checks';
import type { RecordObligation } from './model-evidence';
import { decide, modelEvidence } from './model-evidence';
import {
  type DrawnInstance,
  drawModelInstances,
  instancesReplayPlan,
} from './model-instances';
import { modelParameterId } from './model-parameters';
import { bindingForParameters } from './regression-parameters';
import { registerRegressionTraces } from './regression-tests';
import type { SimulateResult } from './simulate';
import type { ReplayPlan, TraceRun, TraceSlice } from './trace-runs';
import {
  runContext,
  runInSlice,
  runName,
  runObligation,
  runsOfTrace,
} from './trace-runs';

export type RunModelOptions = {
  readonly packageName: string;
  /** Absolute path of the `.qnt` model. */
  readonly specPath: string;
  /** Repo-relative path, as reported (`specs/spaces/space-hosting.qnt`). */
  readonly specUri: string;
  /**
   * The package's report bucket; traces land in `quint/<model>/`, the model
   * evidence in `evidence/`.
   */
  readonly reportDir: string;
  /**
   * Replay only every `count`-th trace from `index`, so one model's traces
   * run as several test files in parallel; a varied model deals out every
   * run of its traces, pinned histories and determinism check instead
   * (`runInSlice`). Every slice draws the same traces (the draw is a function
   * of the model and the seed) into its own `quint/<model>@<k>of<n>/`; slice
   * 0 also runs the model-wide tests.
   */
  readonly slice?: { readonly index: number; readonly count: number };
  /**
   * The most drawn traces replayed through the product; infinite replays
   * them all. Default: the run's (`QUINT_REPLAY_TRACES`), which without a
   * value is the smallest selection that takes every bound action.
   */
  readonly replayTraces?: number;
  /**
   * The replays the package's spec parts were sized for
   * (`tests/quint/replays.json`); `null` when the package plans its models'
   * replays but not this one's. Slice 0 fails when the draw on the plan's
   * seed replays otherwise, so a part's load never silently outgrows it.
   */
  readonly replayPlan?: ReplayPlan | null;
};

type Binding = QuintBinding<unknown>;
type Drawn = SimulateResult;

function boundModel(model: string): Binding | Error {
  try {
    return quintBinding(model);
  } catch (cause) {
    return cause instanceof Error ? cause : new Error(String(cause));
  }
}

/** Register the model's checks and traces with `bun test`. Call at module top level. */
export function runQuintModel(options: RunModelOptions): void {
  const model = basename(options.specPath, '.qnt');
  const slice = options.slice ?? { index: 0, count: 1 };
  const outDir = join(
    options.reportDir,
    'quint',
    slice.count === 1
      ? model
      : `${model}@${String(slice.index)}of${String(slice.count)}`
  );
  const record = modelEvidence(options);
  describe(options.specUri, () => {
    const binding = boundModel(model);
    if (slice.index === 0) {
      registerModelChecks({ specPath: options.specPath, record });
    }
    const shape = modelShapeIssues(
      readFileSync(options.specPath, 'utf8'),
      options.specPath
    );
    if (shape.length > 0) {
      if (slice.index !== 0) {
        test('has a valid aggregate shape', () => {
          throw new Error(
            shape
              .map((item) => formatModelShapeIssue(options.specPath, item))
              .join('\n')
          );
        });
      }
      return;
    }
    let instances: readonly DrawnInstance[];
    try {
      if (binding instanceof Error) throw binding;
      instances = drawModelInstances({ ...options, model, binding, outDir });
    } catch (cause) {
      test('draws traces from the model', () =>
        decide({
          record,
          id: 'simulate',
          layer: 'specification',
          body: () => {
            throw cause;
          },
        }));
      return;
    }
    registerInstances({ options, model, slice, record, binding, instances });
  });
}

function registerInstances(input: {
  readonly options: RunModelOptions;
  readonly model: string;
  readonly slice: TraceSlice;
  readonly record: RecordObligation;
  readonly binding: Binding;
  readonly instances: readonly DrawnInstance[];
}): void {
  const { options, model, slice, record, binding, instances } = input;
  if (slice.index === 0 && options.replayPlan !== undefined)
    registerPlanCheck(options, instancesReplayPlan(instances, binding));
  for (const instance of instances) {
    const id = modelParameterId(instance.parameters);
    const register = () =>
      registerReplays({
        options,
        model,
        ...instance,
        binding: bindingForParameters(binding, instance.parameters),
        slice,
        record: (obligation) =>
          record({
            ...obligation,
            id:
              id === '' || obligation.layer === 'implementation'
                ? obligation.id
                : `${obligation.id} (${id})`,
          }),
      });
    if (id === '') register();
    else describe(id, register);
  }
}

/** The drawn traces' tests: what is replayed, for which runs, in this slice. */
function registerReplays(input: {
  readonly options: RunModelOptions;
  readonly model: string;
  readonly drawn: Drawn;
  readonly binding: Binding;
  readonly record: RecordObligation;
  readonly outDir: string;
  /** The file of the model's tests this run registers. */
  readonly slice: TraceSlice;
  readonly runs: readonly TraceRun[];
}): void {
  const { options, model, drawn, binding, record, slice } = input;
  const first = slice.index === 0;
  const replayed = replaySelection(
    drawn.traces,
    Object.keys(binding.actions),
    options.replayTraces ?? quintReplayBudget()
  );
  writeSummary(input.outDir, options, drawn, replayed);
  const runs = input.runs;
  const cover = replayCover(drawn.traces, Object.keys(binding.actions));
  // Run `run` of test `test` (the traces, the pinned histories, then the
  // determinism check) is this slice's to register.
  const mine = (test: number, run: TraceRun): boolean =>
    runInSlice(test, runs.indexOf(run), runs.length, slice);
  const registration = {
    options,
    model,
    drawn,
    binding,
    record,
    replayed,
    runs,
  };
  if (first) registerModelWide(registration);
  registerDeterminism({
    ...registration,
    // An unvaried model checks it with the draw as a whole, in slice 0.
    mine: (run) =>
      runs.length <= 1
        ? first
        : mine(drawn.traces.length + (binding.regressions?.length ?? 0), run),
  });
  registerTraces({
    ...registration,
    mine: (i, run) => replayed.has(i) && mine(i, run),
    runsOf: (i) => runsOfTrace(i, runs, cover),
  });
  registerRegressionTraces({
    options,
    binding,
    mine: (i, run) => mine(drawn.traces.length + i, run),
    record,
    runs,
  });
}

type Registration = {
  readonly options: RunModelOptions;
  readonly model: string;
  readonly drawn: Drawn;
  readonly binding: Binding;
  readonly record: RecordObligation;
  /** Positions in the draw this run replays through the product. */
  readonly replayed: ReadonlySet<number>;
  /** The model's runs: one, or one per variant. */
  readonly runs: readonly TraceRun[];
};

/**
 * The longest drawn trace; the first drawn on a tie. A replay budget does not
 * move it: the determinism obligation is decided on the trace an exploring
 * run decides it on, so a run's budget never changes that verdict.
 */
function longestTrace(input: Registration) {
  const traces = input.drawn.traces;
  let at = 0;
  for (const [i, trace] of traces.entries()) {
    if (trace.states.length > traces[at]!.states.length) at = i;
  }
  return {
    trace: traces[at]!,
    ctx: traceContext(input.options, input.model, input.drawn.seed, at + 1),
  };
}

/** Slice 0's tests about the draw as a whole. */
function registerModelWide(input: Registration): void {
  const { model, drawn, binding, record } = input;
  const draw = `${String(drawn.traces.length)} traces, seed ${drawn.seed}`;
  test(`every invariant holds while drawing (${draw})`, () =>
    decide({
      record,
      id: 'simulate',
      layer: 'specification',
      body: () => {
        if (drawn.invariants.length === 0) {
          throw new Error(`${model}: a model with no invariant proves nothing`);
        }
        return `${drawn.invariants.join(', ')} held on ${draw}`;
      },
    }));

  test(`takes every bound action (${draw})`, () =>
    decide({
      record,
      id: 'bound-actions',
      layer: 'completeness',
      body: () => {
        const missing = untakenActions(binding, drawn.traces);
        if (missing.length > 0) {
          throw new Error(
            `${model}: no trace took ${missing.join(', ')} — draw more or longer traces (traces / maxSteps in the binding), or unbind the action`
          );
        }
        return `${Object.keys(binding.actions).join(', ')} taken`;
      },
    }));
}

/** The committed plan describes this draw, unless the run drew another seed. */
function registerPlanCheck(options: RunModelOptions, actual: ReplayPlan): void {
  const planned = options.replayPlan;
  if (planned !== null && planned !== undefined && planned.seed !== actual.seed)
    return;
  test('replays what the spec parts plan', () => {
    if (Bun.deepEquals(planned, actual)) return;
    const model = basename(options.specPath, '.qnt');
    throw new Error(
      `${options.specUri}: tests/quint/replays.json plans ${JSON.stringify(planned)} but the draw replays ${JSON.stringify(actual)} — run \`bun run --conditions=browser --conditions=development --preload=@pkgs/bun-test-solid-client-ts/register ../../libs/harness-ts/scripts/model-replays.ts --write\` in the package (it sets "${model}"), then re-plan its specParts`
    );
  });
}

/** Each run's determinism check: the longest trace replayed twice alike. */
function registerDeterminism(
  input: Registration & {
    /** Whether `run`'s check belongs to this slice. */
    readonly mine: (run: TraceRun) => boolean;
  }
): void {
  const { drawn, binding, record } = input;
  if (binding.fingerprint !== undefined && drawn.traces.length > 0) {
    const longest = longestTrace(input);
    for (const run of input.runs) {
      if (!input.mine(run)) continue;
      const replayTwice = () =>
        decide({
          record,
          id: runObligation('determinism', run),
          layer: 'implementation',
          body: async () => {
            await replayTraceTwice({
              ctx: runContext(longest.ctx, run),
              trace: longest.trace,
              world: quintWorld(),
              binding,
            });
            return `trace ${String(longest.ctx.trace)} replayed twice to the same end state`;
          },
        });
      const name = runName(
        `trace ${String(longest.ctx.trace)} replays to the same end state`,
        run
      );
      if (binding.timeoutMs === undefined) test(name, replayTwice);
      else test(name, replayTwice, binding.timeoutMs * 2);
    }
  }
}

function registerTraces(
  input: Registration & {
    /** Whether `run` of trace `i` (0-based) belongs to this slice. */
    readonly mine: (i: number, run: TraceRun) => boolean;
    /** The runs trace `i` is replayed for. */
    readonly runsOf: (i: number) => readonly TraceRun[];
  }
): void {
  const { options, model, drawn, binding, mine, record } = input;
  for (const [i, trace] of drawn.traces.entries()) {
    const n = i + 1;
    const steps = `${String(trace.states.length - 1)} steps`;
    for (const run of input.runsOf(i)) {
      if (!mine(i, run)) continue;
      const ctx = runContext(traceContext(options, model, drawn.seed, n), run);
      const body = () =>
        decide({
          record,
          id: runObligation(`trace:${String(n)}`, run),
          layer: 'implementation',
          body: async () => {
            await replayTrace({ ctx, trace, world: quintWorld(), binding });
            return `the product agreed with the model at every step (${steps}, seed ${drawn.seed})`;
          },
        });
      const name = runName(`trace ${String(n)} (${steps})`, run);
      if (binding.timeoutMs === undefined) test(name, body);
      else test(name, body, binding.timeoutMs);
    }
  }
}

function traceContext(
  options: RunModelOptions,
  model: string,
  seed: string,
  n: number
): TraceContext {
  return {
    packageName: options.packageName,
    specUri: options.specUri,
    model,
    trace: n,
    seed,
    testId: `${model}.trace-${String(n)}`,
    title: `${model} · trace ${String(n)}`,
  };
}

function writeSummary(
  outDir: string,
  options: RunModelOptions,
  drawn: SimulateResult,
  replayed: ReadonlySet<number>
): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'model.json'),
    `${JSON.stringify(
      {
        specUri: options.specUri,
        seed: drawn.seed,
        invariants: drawn.invariants,
        traces: drawn.traces.map((trace) => trace.states.map(describeStep)),
        // 1-based, as the trace tests are named.
        replayed: [...replayed].sort((a, b) => a - b).map((i) => i + 1),
      },
      null,
      2
    )}\n`
  );
}
