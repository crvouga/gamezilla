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
 * `@pkgs/quint-shared/replay-budget` — by default the fewest that take every
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
import type { QuintBinding, TraceContext } from '@pkgs/quint-shared/registry';
import {
  DEFAULT_MAX_STEPS,
  DEFAULT_TRACES,
  quintBinding,
  quintWorld,
  traceVariants,
} from '@pkgs/quint-shared/registry';
import {
  describeStep,
  replayTrace,
  replayTraceTwice,
  untakenActions,
} from '@pkgs/quint-shared/replay';
import { replayCover, replaySelection } from '@pkgs/quint-shared/replay-budget';
import { modelShapeIssues } from '@pkgs/quint-shared/shape';
import { formatModelShapeIssue } from '@pkgs/quint-shared/shape-model';
import { quintReplayBudget } from '@pkgs/quint-shared/wall';
import { registerModelChecks } from './model-checks';
import type { RecordObligation } from './model-evidence';
import { decide, modelEvidence } from './model-evidence';
import { registerRegressionTraces } from './regression-tests';
import { simulate } from './simulate';
import type { TraceRun } from './trace-runs';
import {
  ONCE,
  runContext,
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
   * run as several test files in parallel. Every slice draws the same traces
   * (the draw is a function of the model and the seed) into its own
   * `quint/<model>@<k>of<n>/`; slice 0 also runs the model-wide tests.
   */
  readonly slice?: { readonly index: number; readonly count: number };
  /**
   * The most drawn traces replayed through the product; infinite replays
   * them all. Default: the run's (`QUINT_REPLAY_TRACES`), which without a
   * value is the smallest selection that takes every bound action.
   */
  readonly replayTraces?: number;
};

type Binding = QuintBinding<unknown>;
type Drawn = ReturnType<typeof simulate>;

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
  const mine = (i: number): boolean => i % slice.count === slice.index;
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
    let drawn: Drawn;
    try {
      if (binding instanceof Error) throw binding;
      drawn = simulate({
        specPath: options.specPath,
        traces: binding.traces ?? DEFAULT_TRACES,
        maxSteps: binding.maxSteps ?? DEFAULT_MAX_STEPS,
        outDir,
      });
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
    registerReplays({ options, model, drawn, binding, record, outDir, mine });
  });
}

/** The drawn traces' tests: what is replayed, for which runs, in this slice. */
function registerReplays(input: {
  readonly options: RunModelOptions;
  readonly model: string;
  readonly drawn: Drawn;
  readonly binding: Binding;
  readonly record: RecordObligation;
  readonly outDir: string;
  /** Whether the `i`-th test of the model (0-based) belongs to this slice. */
  readonly mine: (i: number) => boolean;
}): void {
  const { options, model, drawn, binding, record, mine } = input;
  const first = options.slice === undefined || options.slice.index === 0;
  const replayed = replaySelection(
    drawn.traces,
    Object.keys(binding.actions),
    options.replayTraces ?? quintReplayBudget()
  );
  writeSummary(input.outDir, options, drawn, replayed);
  const runs = modelRuns(options, model);
  if (runs.length === 0) {
    if (first)
      test('replays for a variant of the model', () => {
        throw new Error(
          `${options.specUri}: no variant the host registers offers what this model shows`
        );
      });
    return;
  }
  const cover = replayCover(drawn.traces, Object.keys(binding.actions));
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
  registerTraces({
    ...registration,
    mine: (i) => mine(i) && replayed.has(i),
    runsOf: (i) => runsOfTrace(i, runs, cover),
  });
  registerRegressionTraces({
    options,
    binding,
    mine: (i) => mine(drawn.traces.length + i),
    record,
    runs,
  });
}

/** The model's runs: once, or once per variant its host defines. */
function modelRuns(
  options: RunModelOptions,
  model: string
): readonly TraceRun[] {
  const variants = traceVariants({ model, specUri: options.specUri });
  return variants === null ? ONCE : variants.map((variant) => ({ variant }));
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

  if (binding.fingerprint !== undefined && drawn.traces.length > 0) {
    const longest = longestTrace(input);
    for (const run of input.runs) {
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
    /** Whether trace `i` (0-based) belongs to this slice. */
    readonly mine: (i: number) => boolean;
    /** The runs trace `i` is replayed for. */
    readonly runsOf: (i: number) => readonly TraceRun[];
  }
): void {
  const { options, model, drawn, binding, mine, record } = input;
  for (const [i, trace] of drawn.traces.entries()) {
    if (!mine(i)) continue;
    const n = i + 1;
    const steps = `${String(trace.states.length - 1)} steps`;
    for (const run of input.runsOf(i)) {
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
  drawn: ReturnType<typeof simulate>,
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
