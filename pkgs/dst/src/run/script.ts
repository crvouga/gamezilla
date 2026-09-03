import type { Host, Ports, Session } from '../host/types';
import { virtualHost } from '../host/virtual-host';
import type { Rng } from '../kernel/rng';
import type { System } from '../system/define-system';
import type { Action, CatalogProperty, Property, Read } from '../system/effect';
import type { Choice } from '../system/repro';
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
import { ActionNotEnabled, probe } from './probe';

export type Run<S> = {
  readonly apply: <A extends unknown[]>(
    action: Action<S, A>,
    ...args: A
  ) => Promise<void>;
  readonly observe: <T, A extends unknown[]>(
    read: Read<S, A, T>,
    ...args: A
  ) => Promise<T>;
  readonly assert: (p: Property<S>) => Promise<void>;
  readonly elapse: (ms: number) => Promise<void>;
  readonly until: <T>(
    read: Read<S, [], T>,
    opts?: {
      readonly maxMs?: number;
      readonly stepMs?: number;
      readonly pred?: (t: T) => boolean;
    }
  ) => Promise<T>;
  readonly never: <T>(
    read: Read<S, [], T>,
    opts: {
      readonly forMs: number;
      readonly stepMs?: number;
      readonly pred?: (t: T) => boolean;
    }
  ) => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/** Module-private run state — walk / explore / replay only. */
export type RunInternal<S> = {
  readonly surface: S;
  readonly session: Session;
  readonly systemName: string;
  readonly knobs: unknown;
  readonly monitors: MonitorState[];
  readonly transitions: Transition[];
  readonly choices: Choice[];
  rng: Rng;
  step: number;
};

const runInternals = new WeakMap<object, RunInternal<unknown>>();

/** Package-internal accessor — not part of the public `Run` surface. */
export function getRunInternal<S>(run: Run<S>): RunInternal<S> {
  const internal = runInternals.get(run as object);
  if (internal === undefined) {
    throw new Error('getRunInternal: run is not registered');
  }
  return internal as RunInternal<S>;
}

type KnobsOption<K> = [K] extends [void]
  ? { readonly knobs?: undefined }
  : { readonly knobs: K };

export type ScriptOptions<S, K = void> = {
  readonly seed: number | bigint | string;
  readonly host?: Host<Ports>;
  readonly properties?: readonly CatalogProperty<S>[];
} & KnobsOption<K>;

const ELAPSE_ACTION = 'elapse';

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
    settle: () => internal.session.settle(),
    monitors: internal.monitors,
    t: internal.step,
  });
  internal.transitions.push(result.transition);
  internal.choices.push(result.choice);
  if (result.violations.length > 0) throw result.violations[0]!;
}

function buildRun<S>(args: {
  readonly surface: S;
  readonly session: Session;
  readonly system: System<S, unknown>;
  readonly knobs: unknown;
  readonly monitors: MonitorState[];
  readonly actionRng: Rng;
}): Run<S> {
  const transitions: Transition[] = [];
  const choices: Choice[] = [];
  const internal: RunInternal<S> = {
    surface: args.surface,
    session: args.session,
    systemName: args.system.name,
    knobs: args.knobs,
    monitors: args.monitors,
    transitions,
    choices,
    rng: args.actionRng,
    step: 0,
  };

  const run: Run<S> = {
    async apply(action, ...applyArgs) {
      pushMemoFrame();
      let enabled: boolean;
      try {
        const probed = await probe(
          action as Action<S, unknown[]>,
          args.surface
        );
        enabled = probed.enabled;
      } finally {
        popMemoFrame();
      }
      if (!enabled) throw new ActionNotEnabled(action.name);
      await runCheckpoint(internal, action.name, applyArgs, (s, ...a) =>
        (action as Action<S, unknown[]>).act(s, ...(a as never[]))
      );
    },
    async observe(read, ...observeArgs) {
      pushMemoFrame();
      try {
        return await observeRead(read, args.surface, observeArgs);
      } finally {
        popMemoFrame();
      }
    },
    async assert(p) {
      await assertProperty(p, args.surface, internal.step);
    },
    async elapse(ms) {
      await runCheckpoint(internal, ELAPSE_ACTION, [ms], async () => {
        await args.session.elapse(ms);
      });
    },
    async until(read, opts) {
      const maxMs = opts?.maxMs ?? 5_000;
      const stepMs = opts?.stepMs ?? 50;
      const pred = opts?.pred ?? ((t: unknown) => Boolean(t));
      let waited = 0;
      for (;;) {
        const value = await run.observe(read);
        if (pred(value)) return value;
        if (waited >= maxMs) {
          throw new Error(`until: predicate not met within ${String(maxMs)}ms`);
        }
        await run.elapse(stepMs);
        waited += stepMs;
      }
    },
    async never(read, opts) {
      const stepMs = opts.stepMs ?? 50;
      const pred = opts.pred ?? ((t: unknown) => Boolean(t));
      let waited = 0;
      while (waited < opts.forMs) {
        const value = await run.observe(read);
        if (pred(value)) {
          throw new Error(
            `never: predicate became true at ${String(waited)}ms`
          );
        }
        await run.elapse(stepMs);
        waited += stepMs;
      }
    },
    async [Symbol.asyncDispose]() {
      const endViolations = await closeMonitors(args.monitors);
      await args.session.dispose();
      if (endViolations.length > 0) throw endViolations[0]!;
    },
  };
  runInternals.set(run as object, internal as RunInternal<unknown>);
  return run;
}

export async function script<S, K = void>(
  system: System<S, K>,
  opts: ScriptOptions<S, K>
): Promise<Run<S>> {
  const host = opts.host ?? virtualHost();
  const session = await host.open(opts.seed);
  const knobs = ('knobs' in opts ? opts.knobs : undefined) as K;
  const surface = (await system.generate(session, knobs as K)) as S;

  pushMemoFrame();
  let monitors: MonitorState[];
  try {
    monitors = await bootMonitors(
      (opts.properties ?? []) as readonly Property<unknown>[],
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
    knobs,
    monitors,
    actionRng: session.ports.rng.fork('actions'),
  });
}

export { ActionNotEnabled, memoRead, PropertyViolation };
