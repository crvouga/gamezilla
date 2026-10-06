/**
 * Replay one Quint trace against the product: open the world, take each
 * state's action through the binding with the values Quint drew, and after
 * every step require the world to be in the state the model says it is in.
 * The first step the product disagrees with fails the trace, with the whole
 * trace, the variables that differ and what the world was asked to do.
 */

import type { ItfState, ItfTrace, QuintValue } from './itf';
import { quintEqual, renderQuint } from './itf';
import type { Picks, QuintBinding, QuintWorld, TraceContext } from './registry';

/** `create(actor: "alice")` — how a step reads in reports and failures. */
export function describeStep(state: ItfState): string {
  const picks = Object.entries(state.picks)
    .map(([name, value]) => `${name}: ${renderQuint(value)}`)
    .join(', ');
  return `${state.action}(${picks})`;
}

type Mismatch = {
  readonly name: string;
  readonly expected: QuintValue;
  readonly observed: QuintValue;
};

function mismatches(
  expected: Readonly<Record<string, QuintValue>>,
  observed: Readonly<Record<string, QuintValue>>
): readonly Mismatch[] {
  const missing = Object.keys(expected).filter(
    (name) => !name.startsWith('_') && !Object.hasOwn(observed, name)
  );
  if (missing.length > 0) {
    throw new Error(
      `observe did not read public variables: ${missing.join(', ')}`
    );
  }
  const out: Mismatch[] = [];
  for (const [name, value] of Object.entries(observed)) {
    const want = expected[name];
    if (want === undefined) {
      throw new Error(
        `observe returned "${name}", which is not a variable of the model (${Object.keys(expected).join(', ')})`
      );
    }
    if (!quintEqual(want, value)) {
      out.push({ name, expected: want, observed: value });
    }
  }
  return out;
}

/** The part of a state the binding observes, as the report shows it. */
function observedPart(
  state: ItfState,
  names: readonly string[] | null
): string {
  return Object.entries(state.vars)
    .filter(([name]) => names === null || names.includes(name))
    .map(([name, value]) => `${name} = ${renderQuint(value)}`)
    .join('\n');
}

export class TraceDivergence extends Error {
  constructor(
    readonly step: number,
    readonly differences: readonly Mismatch[]
  ) {
    super(
      [
        'the product is not in the state the model reached:',
        ...differences.map(
          (d) =>
            `  ${d.name}\n    model:   ${renderQuint(d.expected)}\n    product: ${renderQuint(d.observed)}`
        ),
      ].join('\n')
    );
    this.name = 'TraceDivergence';
  }
}

export type TraceFailure = {
  readonly ctx: TraceContext;
  readonly trace: ItfTrace;
  /** 0-based index of the failing state (0 is `init`). */
  readonly failedAt: number;
  readonly calls: readonly string[];
  readonly cause: unknown;
};

function causeText(cause: unknown): string {
  if (cause instanceof Error) {
    const stackHead = (cause.stack ?? '')
      .split('\n')
      .filter((line) => line.trim().startsWith('at '))
      .slice(0, cause instanceof TraceDivergence ? 0 : 4);
    return [...cause.message.split('\n'), ...stackHead].join('\n    ');
  }
  return String(cause);
}

export function formatTraceFailure(f: TraceFailure): string {
  const steps = f.trace.states
    .map((state, i) => {
      const mark = i < f.failedAt ? '✓' : i === f.failedAt ? '✗' : '-';
      return `    ${mark} ${String(i).padStart(2)} ${describeStep(state)}`;
    })
    .join('\n');
  const calls =
    f.calls.length === 0
      ? '    (no world calls recorded)'
      : f.calls.map((call) => `    ${call}`).join('\n');
  const failing = f.trace.states[f.failedAt];
  return [
    `trace failed: ${f.ctx.title}`,
    `  package: ${f.ctx.packageName}`,
    `  model:   ${f.ctx.specUri}  (seed ${f.ctx.seed})`,
    `  step:    ${String(f.failedAt)} ${failing === undefined ? '?' : describeStep(failing)}`,
    '  world calls during the step:',
    calls,
    `  cause: ${causeText(f.cause)}`,
    '  trace:',
    steps,
    `  replay: bun run spec ${f.ctx.specUri}  (traces: <package>/.cache/harness-report/<part>/quint/${f.ctx.model}/)`,
  ].join('\n');
}

export type ReplayArgs = {
  readonly ctx: TraceContext;
  readonly trace: ItfTrace;
  readonly world: QuintWorld<unknown>;
  readonly binding: QuintBinding<unknown>;
};

async function checkState(
  { world, binding }: Pick<ReplayArgs, 'world' | 'binding'>,
  w: unknown,
  step: number,
  state: ItfState
): Promise<readonly string[]> {
  let observed = await binding.observe(w);
  if (
    world.settle !== undefined &&
    mismatches(state.vars, observed).length > 0
  ) {
    await world.settle(
      w,
      async () => {
        observed = await binding.observe(w);
        return mismatches(state.vars, observed).length === 0;
      },
      binding.settleStepMs === undefined ? {} : { stepMs: binding.settleStepMs }
    );
  }
  const names = Object.keys(observed);
  if (names.length === 0) {
    throw new Error(`${binding.model}: observe returned no model variable`);
  }
  const differences = mismatches(state.vars, observed);
  if (differences.length > 0) throw new TraceDivergence(step, differences);
  return names;
}

/**
 * Replay one trace in a fresh world, checking the model's state after every
 * step. Returns the binding's fingerprint of the end state (`null` without
 * one).
 */
export async function replayTrace(args: ReplayArgs): Promise<string | null> {
  const { ctx, trace, world, binding } = args;
  const w = await world.create(ctx);
  let at = 0;
  let callsBefore = 0;
  let observedNames: readonly string[] | null = null;
  try {
    for (const [index, state] of trace.states.entries()) {
      at = index;
      callsBefore = world.calls?.(w).length ?? 0;
      const act = binding.actions[state.action];
      const run = async () => {
        if (act === undefined) {
          throw new Error(
            `${binding.model} has no binding for Quint action "${state.action}" (bound: ${Object.keys(binding.actions).join(', ')})`
          );
        }
        await act(w, state.picks as Picks);
        observedNames = await checkState(args, w, index, state);
      };
      const meta = {
        title: describeStep(state),
        detail: observedPart(state, observedNames),
      };
      await (world.record === undefined ? run() : world.record(w, meta, run));
    }
    return binding.fingerprint === undefined
      ? null
      : await binding.fingerprint(w);
  } catch (cause) {
    throw new Error(
      formatTraceFailure({
        ctx,
        trace,
        failedAt: at,
        calls: (world.calls?.(w) ?? []).slice(callsBefore),
        cause,
      }),
      { cause }
    );
  } finally {
    await world.dispose(w);
  }
}

/**
 * Replay one trace twice, each in a fresh world, and require the binding's
 * fingerprint of the end state to agree: the same seed and trace must end
 * in the same state.
 */
export async function replayTraceTwice(args: ReplayArgs): Promise<void> {
  const once = await replayTrace(args);
  const twice = await replayTrace(args);
  if (once !== twice) {
    throw new Error(
      `${args.binding.model}: trace ${String(args.ctx.trace)} replayed twice ended in different states — the run depends on more than its seed and trace\n  once:  ${String(once)}\n  twice: ${String(twice)}`
    );
  }
}

/**
 * Bound actions no trace took. A trace set that never takes an action says
 * nothing about it, so the model's run fails rather than passing vacuously —
 * draw more traces or longer ones, or drop the action from the binding.
 */
export function untakenActions(
  binding: QuintBinding<unknown>,
  traces: readonly ItfTrace[]
): readonly string[] {
  const taken = new Set(
    traces.flatMap((trace) => trace.states.map((state) => state.action))
  );
  return Object.keys(binding.actions).filter((name) => !taken.has(name));
}
