import type { Rng } from '../internals/rng';
import type { CatalogSnapshot } from '../report/define-snapshot';
import { RunReporter } from '../report/reporter';
import { type RunReportOptions, resolveReportOptions } from '../report/types';
import type { Session } from '../runtime/types';
import type { Action, CatalogProperty, Property, Read } from '../system/effect';
import type { Step } from '../system/recording';
import {
  getSystemRegistry,
  type RuntimeOption,
  resolveRuntime,
  type SystemCore as System,
} from '../system/registry';
import {
  assertProperty,
  bootMonitors,
  checkpoint,
  disposeMonitors,
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
  /** Runtime name or inline RuntimeDef. Omit → system default runtime. */
  readonly runtime?: RuntimeOption;
  /**
   * Timeline reporting. Default off.
   * Pass `true` for in-memory only, or `{ store, testId, … }` to persist.
   */
  readonly report?: boolean | RunReportOptions;
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

  const doCheckpoint = () =>
    runCheckpoint(internal, action.name, resolved, (surf, ...a) =>
      action.act(surf, ...(a as never[]))
    );

  const reporter = internal.reporter;
  if (reporter !== null && reporter.shouldCaptureApply) {
    await reporter.recordApply({
      action: action.name,
      applyArgs: resolved,
      run: doCheckpoint,
    });
    return;
  }
  await doCheckpoint();
}

async function disposeRun(
  monitors: MonitorState[],
  surface: unknown,
  reporter: RunReporter | null,
  session: Session
): Promise<void> {
  const endViolations = await disposeMonitors(monitors, surface);
  if (reporter !== null) {
    await reporter.flush();
  }
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
  readonly reporter: RunReporter | null;
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
    reporter: args.reporter,
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
      // Never opens a report step (avoids poll spam during until/expect).
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
    async record(meta, fn) {
      const reporter = internal.reporter;
      if (reporter === null) return fn();
      let result!: Awaited<ReturnType<typeof fn>>;
      await reporter.record(meta, async () => {
        result = await fn();
      });
      return result;
    },
    async snapshot() {
      if (internal.reporter === null) return;
      await internal.reporter.snapshot();
    },
    report() {
      return internal.reporter?.toReport() ?? null;
    },
    [Symbol.asyncDispose]: () =>
      disposeRun(args.monitors, args.surface, internal.reporter, args.session),
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

  const reportOpts = resolveReportOptions(opts.report);
  const reporter =
    reportOpts === null
      ? null
      : new RunReporter({
          system: system.name,
          runtime: runtimeName,
          seed: String(opts.seed),
          options: reportOpts,
          snapshots: registry.snapshots as readonly CatalogSnapshot<unknown>[],
          surface,
          sessionNow: () => session.ports.clock.now(),
        });

  return buildRun({
    surface,
    session,
    system: system as System<S, unknown>,
    systemArgs,
    runtimeName,
    monitors,
    actionRng: session.ports.rng.fork('actions'),
    reporter,
  });
}

export { ActionNotEnabled, memoRead, PropertyViolation };
