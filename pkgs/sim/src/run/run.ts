import type { Rng } from '../internals/rng';
import type { Session } from '../runtime/types';
import type { Action, CatalogProperty, Property, Read } from '../system/effect';
import type { Step } from '../system/recording';
import {
  getSystemRegistry,
  resolveRuntime,
  type SystemCore as System,
} from '../system/registry';
import {
  assertProperty,
  bootMonitors,
  checkpoint,
  closeMonitors,
  type MonitorState,
  observeRead,
  PropertyViolation,
  resumeMonitors,
  type Transition,
} from './checkpoint';
import { memoRead, popMemoFrame, pushMemoFrame } from './memo';
import { ActionNotEnabled } from './probe';
import { type Run, type RunInternal, setRunInternal } from './run-types';

export type { Run, RunInternal } from './run-types';
export { getRunInternal } from './run-types';

type ArgsOption<Args> = [Args] extends [void]
  ? { readonly args?: undefined }
  : { readonly args?: Partial<Args> };

export type RunOptions<_S, Args = void> = {
  readonly seed: number | bigint | string;
  /** Registered runtime name. Omit → system default runtime. */
  readonly runtime?: string;
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
  for (;;) {
    const value = await s.read(read);
    if (pred(value)) return value;
    if (waited >= maxMs) {
      throw new Error(`until: predicate not met within ${String(maxMs)}ms`);
    }
    await s.advanceTime(stepMs);
    waited += stepMs;
  }
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
    async apply(action, ...applyArgs) {
      const resolved = resolveApplyArgs(
        action as Action<S, unknown[]>,
        applyArgs as unknown[]
      );
      // Scripted apply is gated by `enabled` only — `weight` 0 merely keeps
      // an action out of randomActions (probe), so pins can still drive it.
      pushMemoFrame();
      let enabled: boolean;
      try {
        enabled = await action.enabled(args.surface);
      } finally {
        popMemoFrame();
      }
      if (!enabled) throw new ActionNotEnabled(action.name);
      await runCheckpoint(internal, action.name, resolved, (surf, ...a) =>
        (action as Action<S, unknown[]>).act(surf, ...(a as never[]))
      );
    },
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
    until: (readFn, opts) => runUntil(s, readFn, opts),
    never: (readFn, opts) => runNever(s, readFn, opts),
    async randomActions(opts) {
      const { randomActions } = await import('./random-actions');
      return randomActions(s, opts ?? {});
    },
    async [Symbol.asyncDispose]() {
      const endViolations = await closeMonitors(args.monitors);
      await args.session.dispose();
      if (endViolations.length > 0) throw endViolations[0]!;
    },
  };
  setRunInternal(s, internal);
  return s;
}

/** Package-internal — preferred entry is `system.run`. */
export async function run<S, Args = void>(
  system: System<S, Args>,
  opts: RunOptions<S, Args>
): Promise<Run<S>> {
  const runtimeName =
    opts.runtime ??
    getSystemRegistry(system as System<S, unknown>).defaultRuntimeName;
  if (runtimeName === undefined) {
    throw new Error(
      `run: system '${system.name}' has no default runtime (register with system.runtime)`
    );
  }
  const runtime = await resolveRuntime(
    system as System<unknown, unknown>,
    runtimeName
  );
  const session = await runtime.open(opts.seed);
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

export { ActionNotEnabled, memoRead, PropertyViolation };
