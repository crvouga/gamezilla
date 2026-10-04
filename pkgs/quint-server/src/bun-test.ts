/**
 * Run a Quint model under `bun test`: one `describe` per model with, before
 * any trace reaches the product, a test that the model type checks; then one
 * `test` per trace Quint draws from it, one that
 * fails when the traces never take a bound action, and (with a fingerprint)
 * one that a trace replayed twice ends the same. Every decided obligation is
 * recorded as evidence in the report bucket (`./model-evidence`). The
 * runner-generated stub (`.cache/spec/<name>.qnt.test.ts`) imports the
 * package's quint entry (which registers the world and the bindings) and
 * calls {@link runQuintModel}.
 */

import { describe, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { registerModelChecks } from './model-checks';
import { decide, modelEvidence } from './model-evidence';
import type { RecordObligation } from './model-evidence';
import { DEFAULT_MAX_STEPS, DEFAULT_TRACES, quintBinding, quintWorld } from '@pkgs/quint-shared/registry';
import type { QuintBinding, TraceContext } from '@pkgs/quint-shared/registry';
import { registerRegressionTraces } from './regression-tests';
import {
  describeStep,
  replayTrace,
  replayTraceTwice,
  untakenActions,
} from '@pkgs/quint-shared/replay';
import { formatModelShapeIssue } from '@pkgs/quint-shared/shape-model';
import { modelShapeIssues } from '@pkgs/quint-shared/shape';
import { simulate } from './simulate';

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
    writeSummary(outDir, options, drawn);
    if (slice.index === 0) {
      registerModelWide({ options, model, drawn, binding, record });
    }
    registerTraces({ options, model, drawn, binding, mine, record });
    registerRegressionTraces({
      options,
      binding,
      mine: (i) => mine(drawn.traces.length + i),
      record,
    });
  });
}

type Registration = {
  readonly options: RunModelOptions;
  readonly model: string;
  readonly drawn: Drawn;
  readonly binding: Binding;
  readonly record: RecordObligation;
};

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
    const replayTwice = () =>
      decide({
        record,
        id: 'determinism',
        layer: 'implementation',
        body: async () => {
          await replayTraceTwice({
            ctx: longest.ctx,
            trace: longest.trace,
            world: quintWorld(),
            binding,
          });
          return `trace ${String(longest.ctx.trace)} replayed twice to the same end state`;
        },
      });
    const name = `trace ${String(longest.ctx.trace)} replays to the same end state`;
    if (binding.timeoutMs === undefined) test(name, replayTwice);
    else test(name, replayTwice, binding.timeoutMs * 2);
  }
}

function registerTraces(
  input: Registration & {
    /** Whether trace `i` (0-based) belongs to this slice. */
    readonly mine: (i: number) => boolean;
  }
): void {
  const { options, model, drawn, binding, mine, record } = input;
  for (const [i, trace] of drawn.traces.entries()) {
    if (!mine(i)) continue;
    const n = i + 1;
    const ctx = traceContext(options, model, drawn.seed, n);
    const steps = `${String(trace.states.length - 1)} steps`;
    const body = () =>
      decide({
        record,
        id: `trace:${String(n)}`,
        layer: 'implementation',
        body: async () => {
          await replayTrace({ ctx, trace, world: quintWorld(), binding });
          return `the product agreed with the model at every step (${steps}, seed ${drawn.seed})`;
        },
      });
    const name = `trace ${String(n)} (${steps})`;
    if (binding.timeoutMs === undefined) test(name, body);
    else test(name, body, binding.timeoutMs);
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
  drawn: ReturnType<typeof simulate>
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
      },
      null,
      2
    )}\n`
  );
}
