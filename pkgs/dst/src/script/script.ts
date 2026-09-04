import type { Session } from '../host/types';
import type { Rng } from '../kernel/rng';
import {
  getSystemRegistry,
  resolveHost,
  type System,
} from '../system/define-system';
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
import type { Walk, WalkOptions } from './walk';

/** Rest args: full override, or empty to use `action.args` defaults. */
type ApplyRest<A extends unknown[]> = A | [];

export type Script<S> = {
  readonly apply: <A extends unknown[]>(
    action: Action<S, A>,
    ...args: ApplyRest<A>
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
  readonly walk: (opts?: WalkOptions<S>) => Promise<Walk>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/** Module-private script state — walk / explore / replay only. */
export type ScriptInternal<S> = {
  readonly surface: S;
  readonly session: Session;
  readonly system: System<S, unknown>;
  readonly systemName: string;
  readonly args: unknown;
  readonly hostName: string;
  readonly monitors: MonitorState[];
  readonly transitions: Transition[];
  readonly choices: Choice[];
  rng: Rng;
  step: number;
};

const scriptInternals = new WeakMap<object, ScriptInternal<unknown>>();

/** Package-internal accessor — not part of the public `Script` surface. */
export function getScriptInternal<S>(s: Script<S>): ScriptInternal<S> {
  const internal = scriptInternals.get(s as object);
  if (internal === undefined) {
    throw new Error('getScriptInternal: script is not registered');
  }
  return internal as ScriptInternal<S>;
}

type ArgsOption<Args> = [Args] extends [void]
  ? { readonly args?: undefined }
  : { readonly args?: Partial<Args> };

export type ScriptOptions<_S, Args = void> = {
  readonly seed: number | bigint | string;
  /** Registered host name. Omit → system default host. */
  readonly host?: string;
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

async function scriptCheckpoint<S>(
  internal: ScriptInternal<S>,
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

function buildScript<S>(args: {
  readonly surface: S;
  readonly session: Session;
  readonly system: System<S, unknown>;
  readonly systemArgs: unknown;
  readonly hostName: string;
  readonly monitors: MonitorState[];
  readonly actionRng: Rng;
}): Script<S> {
  const transitions: Transition[] = [];
  const choices: Choice[] = [];
  const internal: ScriptInternal<S> = {
    surface: args.surface,
    session: args.session,
    system: args.system,
    systemName: args.system.name,
    args: args.systemArgs,
    hostName: args.hostName,
    monitors: args.monitors,
    transitions,
    choices,
    rng: args.actionRng,
    step: 0,
  };

  const s: Script<S> = {
    async apply(action, ...applyArgs) {
      const resolved = resolveApplyArgs(
        action as Action<S, unknown[]>,
        applyArgs as unknown[]
      );
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
      await scriptCheckpoint(internal, action.name, resolved, (s, ...a) =>
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
      await scriptCheckpoint(internal, ELAPSE_ACTION, [ms], async () => {
        await args.session.elapse(ms);
      });
    },
    async until(read, opts) {
      const maxMs = opts?.maxMs ?? 5_000;
      const stepMs = opts?.stepMs ?? 50;
      const pred = opts?.pred ?? ((t: unknown) => Boolean(t));
      let waited = 0;
      for (;;) {
        const value = await s.observe(read);
        if (pred(value)) return value;
        if (waited >= maxMs) {
          throw new Error(`until: predicate not met within ${String(maxMs)}ms`);
        }
        await s.elapse(stepMs);
        waited += stepMs;
      }
    },
    async never(read, opts) {
      const stepMs = opts.stepMs ?? 50;
      const pred = opts.pred ?? ((t: unknown) => Boolean(t));
      let waited = 0;
      while (waited < opts.forMs) {
        const value = await s.observe(read);
        if (pred(value)) {
          throw new Error(
            `never: predicate became true at ${String(waited)}ms`
          );
        }
        await s.elapse(stepMs);
        waited += stepMs;
      }
    },
    async walk(opts) {
      const { walk } = await import('./walk');
      return walk(s, opts ?? {});
    },
    async [Symbol.asyncDispose]() {
      const endViolations = await closeMonitors(args.monitors);
      await args.session.dispose();
      if (endViolations.length > 0) throw endViolations[0]!;
    },
  };
  scriptInternals.set(s as object, internal as ScriptInternal<unknown>);
  return s;
}

/** Package-internal — preferred entry is `system.script`. */
export async function script<S, Args = void>(
  system: System<S, Args>,
  opts: ScriptOptions<S, Args>
): Promise<Script<S>> {
  const hostName =
    opts.host ??
    getSystemRegistry(system as System<S, unknown>).defaultHostName;
  if (hostName === undefined) {
    throw new Error(
      `script: system '${system.name}' has no default host (register with system.host)`
    );
  }
  const host = await resolveHost(system as System<unknown, unknown>, hostName);
  const session = await host.open(opts.seed);
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

  return buildScript({
    surface,
    session,
    system: system as System<S, unknown>,
    systemArgs,
    hostName,
    monitors,
    actionRng: session.ports.rng.fork('actions'),
  });
}

export { ActionNotEnabled, memoRead, PropertyViolation };
