import type { MonitorState, Transition } from './checkpoint';
import {
  assertProperty,
  bootMonitors,
  checkpoint,
  disposeMonitors,
  observeRead,
  resumeMonitors,
} from './checkpoint';
import type { Action, CatalogProperty, Property, Read } from './effect';
import { popMemoFrame, pushMemoFrame } from './memo';
import { ActionNotEnabled } from './probe';
import type { Step } from './recording';
import type { RuntimeOption, SystemCore as System } from './registry';
import { getSystemRegistry, resolveRuntime } from './registry';
import type { Rng } from './rng';
import type { Run, RunInternal } from './run-types';
import { setRunInternal } from './run-types';
import type { Session } from './runtime-types';

type ArgsOption<Args> = [Args] extends [void]
  ? { readonly args?: undefined }
  : { readonly args?: Partial<Args> };

export type RunOptions<_S, Args = void> = {
  readonly seed: number | bigint | string;
  /** Runtime name or inline RuntimeDef. Omit → system default runtime. */
  readonly runtime?: RuntimeOption;
} & ArgsOption<Args>;

const ELAPSE_ACTION = 'elapse';

function mergeArgs<Args>(
  defaults: Args | undefined,
  overlay: Partial<Args> | undefined
): Args {
  if (defaults === undefined && overlay === undefined) {
    return undefined as Args;
  }
  if (
    defaults !== null &&
    typeof defaults === 'object' &&
    !Array.isArray(defaults)
  ) {
    return {
      ...(defaults as Record<string, unknown>),
      ...((overlay ?? {}) as Record<string, unknown>),
    } as Args;
  }
  return (overlay !== undefined ? overlay : defaults) as Args;
}

function resolveApplyArgs<S, A extends unknown[]>(
  action: Action<S, A>,
  applyArgs: unknown[]
): A {
  if (applyArgs.length > 0) return applyArgs as A;
  if (action.args !== undefined) return action.args;
  return [] as unknown as A;
}

async function runCheckpoint<S>(
  internal: RunInternal<S>,
  actionName: string,
  applyArgs: readonly unknown[],
  act: (s: S, ...a: unknown[]) => unknown | Promise<unknown>
): Promise<void> {
  internal.step += 1;
  const result = await checkpoint({
    actionName,
    applyArgs,
    act,
    surface: internal.surface,
    waitForIdle: () => internal.session.waitForIdle(),
    monitors: internal.monitors,
    t: internal.step,
  });
  internal.transitions.push(result.transition);
  internal.steps.push(result.step);
  if (result.violations.length > 0) throw result.violations[0]!;
}

async function runUntil<S, T>(
  s: Run<S>,
  read: Read<S, [], T>,
  starvedAdvances: () => number,
  opts?: {
    readonly maxMs?: number;
    readonly stepMs?: number;
    readonly pred?: (t: T) => boolean;
  }
): Promise<T> {
  const maxMs = opts?.maxMs ?? 5_000;
  const stepMs = opts?.stepMs ?? 50;
  const pred = opts?.pred ?? ((t: unknown) => Boolean(t));
  let waited = 0;
  let granted = 0;
  for (;;) {
    const value = await s.read(read);
    if (pred(value)) return value;
    if (waited >= maxMs) {
      // Say what it actually saw. "predicate not met" alone cannot tell a
      // scenario that converged on the wrong value from one that never
      // converged at all, and that is the whole difference when diagnosing.
      throw new Error(
        `until: predicate not met within ${String(maxMs)}ms of virtual time ` +
          `(${String(Math.round(maxMs / stepMs))} polls); last value: ${describeValue(value)}`
      );
    }
    // A poll the drain spent running ahead of unfinished wall work did not
    // advance the simulation, so it must not spend the budget either: that is
    // how a busy machine turns a converging scenario into a timeout. The grace
    // is capped, so a genuinely stuck wait still ends — at worst it polls
    // twice as many times.
    const starvedBefore = starvedAdvances();
    await s.advanceTime(stepMs);
    const starved = starvedAdvances() > starvedBefore;
    if (starved && granted < maxMs) {
      granted += stepMs;
      continue;
    }
    waited += stepMs;
  }
}

/** A short, safe rendering of whatever a read returned. */
function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 200);
    } catch {
      return '[unserializable object]';
    }
  }
  return String(value).slice(0, 200);
}

async function runNever<S, T>(
  s: Run<S>,
  read: Read<S, [], T>,
  opts: {
    readonly forMs: number;
    readonly stepMs?: number;
    readonly pred?: (t: T) => boolean;
  }
): Promise<void> {
  const stepMs = opts.stepMs ?? 50;
  const pred = opts.pred ?? ((t: unknown) => Boolean(t));
  let waited = 0;
  while (waited < opts.forMs) {
    const value = await s.read(read);
    if (pred(value)) {
      throw new Error(`never: predicate became true at ${String(waited)}ms`);
    }
    await s.advanceTime(stepMs);
    waited += stepMs;
  }
}

async function applyAction<S>(
  internal: RunInternal<S>,
  surface: S,
  action: Action<S, unknown[]>,
  applyArgs: unknown[]
): Promise<void> {
  const resolved = resolveApplyArgs(action, applyArgs);
  // Scripted apply is gated by `enabled` only — `weight` 0 merely keeps
  // an action out of randomActions (probe), so pins can still drive it.
  pushMemoFrame();
  let enabled: boolean;
  try {
    enabled = await action.enabled(surface);
  } finally {
    popMemoFrame();
  }
  if (!enabled) throw new ActionNotEnabled(action.name);

  await runCheckpoint(internal, action.name, resolved, (surf, ...a) =>
    action.act(surf, ...(a as never[]))
  );
}

async function disposeRun(
  monitors: MonitorState[],
  surface: unknown,
  session: Session
): Promise<void> {
  const endViolations = await disposeMonitors(monitors, surface);
  await session.dispose();
  if (endViolations.length > 0) throw endViolations[0]!;
}

function buildRun<S>(args: {
  readonly surface: S;
  readonly session: Session;
  readonly system: System<S, unknown>;
  readonly systemArgs: unknown;
  readonly runtimeName: string;
  readonly monitors: MonitorState[];
  readonly actionRng: Rng;
}): Run<S> {
  const transitions: Transition[] = [];
  const steps: Step[] = [];
  const internal: RunInternal<S> = {
    surface: args.surface,
    session: args.session,
    system: args.system,
    systemName: args.system.name,
    args: args.systemArgs,
    runtimeName: args.runtimeName,
    monitors: args.monitors,
    transitions,
    steps,
    rng: args.actionRng,
    step: 0,
  };

  const s: Run<S> = {
    apply: (action, ...applyArgs) =>
      applyAction(
        internal,
        args.surface,
        action as unknown as Action<S, unknown[]>,
        applyArgs as unknown[]
      ),
    async read(readFn, ...readArgs) {
      pushMemoFrame();
      try {
        return await observeRead(readFn, args.surface, readArgs);
      } finally {
        popMemoFrame();
      }
    },
    async assert(p) {
      await assertProperty(p, args.surface, internal.step);
    },
    async advanceTime(ms) {
      await runCheckpoint(internal, ELAPSE_ACTION, [ms], async () => {
        await args.session.advanceTime(ms);
      });
    },
    until: (readFn, opts) =>
      runUntil(s, readFn, () => args.session.scheduler.starvedAdvances(), opts),
    never: (readFn, opts) => runNever(s, readFn, opts),
    async randomActions(opts) {
      const { randomActions } = await import('./random-actions');
      return randomActions(s, opts ?? {});
    },
    [Symbol.asyncDispose]: () =>
      disposeRun(args.monitors, args.surface, args.session),
  };
  setRunInternal(s, internal);
  return s;
}

/** Package-internal — preferred entry is `system.run`. */
export async function run<S, Args = void>(
  system: System<S, Args>,
  opts: RunOptions<S, Args>
): Promise<Run<S>> {
  const resolved = await resolveRuntime(
    system as System<unknown, unknown>,
    opts.runtime
  );
  const runtimeName = resolved.name;
  const session = await resolved.runtime.open(opts.seed);
  const systemArgs = mergeArgs(
    system.args,
    ('args' in opts ? opts.args : undefined) as Partial<Args> | undefined
  );
  const surface = (await system.create(session, systemArgs as Args)) as S;

  const registry = getSystemRegistry(system as System<S, unknown>);
  const properties = registry.properties as readonly CatalogProperty<S>[];

  pushMemoFrame();
  let monitors: MonitorState[];
  try {
    monitors = await bootMonitors(
      properties as readonly Property<unknown>[],
      surface
    );
    const v0 = await resumeMonitors(monitors, surface, 0);
    if (v0.length > 0) throw v0[0]!;
  } finally {
    popMemoFrame();
  }

  return buildRun({
    surface,
    session,
    system: system as System<S, unknown>,
    systemArgs,
    runtimeName,
    monitors,
    actionRng: session.ports.rng.fork('actions'),
  });
}
