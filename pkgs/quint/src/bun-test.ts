/**
 * Run a Quint model under `bun test`: one `describe` per model, one `test`
 * per trace Quint draws from it, plus one that fails when the traces never
 * take a bound action. The runner-generated stub
 * (`.cache/spec/<name>.qnt.test.ts`) imports the package's quint entry
 * (which registers the world and the bindings) and calls
 * {@link runQuintModel}.
 */

import { describe, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import {
  DEFAULT_MAX_STEPS,
  DEFAULT_TRACES,
  quintBinding,
  quintWorld,
  type TraceContext,
} from './registry';
import {
  describeStep,
  replayTrace,
  replayTraceTwice,
  untakenActions,
} from './replay';
import { simulate } from './simulate';

export type RunModelOptions = {
  readonly packageName: string;
  /** Absolute path of the `.qnt` model. */
  readonly specPath: string;
  /** Repo-relative path, as reported (`specs/spaces/space-hosting.qnt`). */
  readonly specUri: string;
  /** The package's report bucket; traces land in `quint/<model>/`. */
  readonly reportDir: string;
  /**
   * Replay only every `count`-th trace from `index`, so one model's traces
   * run as several test files in parallel. Every slice draws the same traces
   * (the draw is a function of the model and the seed) into its own
   * `quint/<model>@<k>of<n>/`; slice 0 also runs the model-wide tests.
   */
  readonly slice?: { readonly index: number; readonly count: number };
};

/** Register the model's traces with `bun test`. Call at module top level. */
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
  describe(options.specUri, () => {
    let prepared: {
      readonly binding: ReturnType<typeof quintBinding>;
      readonly drawn: ReturnType<typeof simulate>;
    };
    try {
      const binding = quintBinding(model);
      const drawn = simulate({
        specPath: options.specPath,
        traces: binding.traces ?? DEFAULT_TRACES,
        maxSteps: binding.maxSteps ?? DEFAULT_MAX_STEPS,
        outDir,
      });
      prepared = { binding, drawn };
    } catch (cause) {
      test('draws traces from the model', () => {
        throw cause;
      });
      return;
    }
    const { binding, drawn } = prepared;
    const longestTrace = (traces: typeof drawn.traces) => {
      let at = 0;
      for (const [i, trace] of traces.entries()) {
        if (trace.states.length > traces[at]!.states.length) at = i;
      }
      return {
        trace: traces[at]!,
        ctx: traceContext(options, model, drawn.seed, at + 1),
      };
    };
    writeSummary(outDir, options, drawn);
    if (slice.index !== 0) {
      registerTraces({ options, model, drawn, binding, mine });
      return;
    }

    test(`takes every bound action (${String(drawn.traces.length)} traces, seed ${drawn.seed})`, () => {
      const missing = untakenActions(binding, drawn.traces);
      if (missing.length > 0) {
        throw new Error(
          `${model}: no trace took ${missing.join(', ')} — draw more or longer traces (traces / maxSteps in the binding), or unbind the action`
        );
      }
    });

    if (binding.fingerprint !== undefined && drawn.traces.length > 0) {
      const longest = longestTrace(drawn.traces);
      const replayTwice = () =>
        replayTraceTwice({
          ctx: longest.ctx,
          trace: longest.trace,
          world: quintWorld(),
          binding,
        });
      const name = `trace ${String(longest.ctx.trace)} replays to the same end state`;
      if (binding.timeoutMs === undefined) test(name, replayTwice);
      else test(name, replayTwice, binding.timeoutMs * 2);
    }

    registerTraces({ options, model, drawn, binding, mine });
  });
}

function registerTraces(input: {
  readonly options: RunModelOptions;
  readonly model: string;
  readonly drawn: ReturnType<typeof simulate>;
  readonly binding: ReturnType<typeof quintBinding>;
  /** Whether trace `i` (0-based) belongs to this slice. */
  readonly mine: (i: number) => boolean;
}): void {
  const { options, model, drawn, binding, mine } = input;
  for (const [i, trace] of drawn.traces.entries()) {
    if (!mine(i)) continue;
    const n = i + 1;
    const ctx = traceContext(options, model, drawn.seed, n);
    const body = () =>
      replayTrace({ ctx, trace, world: quintWorld(), binding });
    const name = `trace ${String(n)} (${String(trace.states.length - 1)} steps)`;
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
