import type { Host, Ports, Session } from '../host/types';
import { virtualHost } from '../host/virtual-host';
import type { JsonValue } from '../kernel/json';
import { createScriptedDraws, type Rng } from '../kernel/rng';
import type { System } from '../system/define-system';
import type { Action, Observation, Property } from '../system/effect';
import type { Choice } from '../system/repro';
import {
  checkpoint,
  closeMonitors,
  type MonitorState,
  PropertyViolation,
  resumeMonitors,
  scriptedApply,
  type Transition,
} from './checkpoint';
import { type DriveContext, drive, resolveObservation } from './drive';
import { ActionNotEnabled, finishProbed, probe } from './probe';

export type Run<S> = {
  readonly apply: (
    action: Action<S>,
    ...draws: readonly unknown[]
  ) => Promise<void>;
  readonly observe: <T extends JsonValue>(o: Observation<S, T>) => Promise<T>;
  readonly assert: (p: Property<S>) => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/** Module-private run state — walk / check / replay only. */
export type RunInternal<S> = {
  readonly surface: S;
  readonly session: Session;
  readonly systemName: string;
  readonly systemDraws: readonly number[];
  readonly memo: Map<string, JsonValue>;
  readonly monitors: MonitorState[];
  readonly transitions: Transition[];
  readonly choices: Choice[];
  rng: Rng;
  step: number;
  readonly ctx: () => DriveContext<S>;
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

export type StartOptions<S> = {
  readonly seed: number | bigint | string;
  readonly host?: Host<Ports>;
  readonly draws?: readonly unknown[];
  readonly properties?: readonly Property<S>[];
};

function recordingRng(base: Rng, buf: number[]): Rng {
  const wrap = (r: Rng): Rng => ({
    next() {
      const v = r.next();
      buf.push(v);
      return v;
    },
    fork(name) {
      return wrap(r.fork(name));
    },
  });
  return wrap(base);
}

async function bootMonitors(monitors: MonitorState[]): Promise<void> {
  for (const m of monitors) {
    try {
      const r =
        Symbol.asyncIterator in Object(m.body)
          ? await (m.body as AsyncGenerator<unknown, void, unknown>).next()
          : (m.body as Generator<unknown, void, unknown>).next();
      if (!r.done) {
        m.pending = r.value as Observation<unknown, JsonValue>;
      } else {
        m.closed = true;
      }
    } catch (e) {
      throw new PropertyViolation(m.property.name, 0, e);
    }
  }
}

async function assertOnce<S>(
  p: Property<S>,
  ctx: DriveContext<S>,
  step: number
): Promise<void> {
  const body = p.watch();
  try {
    const first =
      Symbol.asyncIterator in Object(body)
        ? await (body as AsyncGenerator<unknown, void, unknown>).next()
        : (body as Generator<unknown, void, unknown>).next();
    if (first.done) return;
    const obs = first.value as Observation<S, JsonValue>;
    const value = await resolveObservation(obs, ctx);
    if (Symbol.asyncIterator in Object(body)) {
      await (body as AsyncGenerator<unknown, void, unknown>).next(value);
    } else {
      (body as Generator<unknown, void, unknown>).next(value);
    }
    await closeMonitors([
      {
        property: p as Property<unknown>,
        body: body as MonitorState['body'],
        pending: null,
        closed: false,
      },
    ]);
  } catch (e) {
    if (e instanceof PropertyViolation) throw e;
    throw new PropertyViolation(p.name, step, e);
  }
}

function buildRun<S>(args: {
  readonly surface: S;
  readonly session: Session;
  readonly system: System<S>;
  readonly systemDraws: number[];
  readonly memo: Map<string, JsonValue>;
  readonly monitors: MonitorState[];
  readonly actionRng: Rng;
}): Run<S> {
  const transitions: Transition[] = [];
  const choices: Choice[] = [];
  const internal: RunInternal<S> = {
    surface: args.surface,
    session: args.session,
    systemName: args.system.name,
    systemDraws: args.systemDraws,
    memo: args.memo,
    monitors: args.monitors,
    transitions,
    choices,
    rng: args.actionRng,
    step: 0,
    ctx: () => ({
      surface: args.surface,
      session: args.session,
      memo: args.memo,
      rng: internal.rng,
    }),
  };

  const run: Run<S> = {
    async apply(action, ...draws) {
      const ctx = internal.ctx();
      internal.step += 1;
      const t = internal.step;
      const result =
        draws.length > 0
          ? await scriptedApply({
              action,
              draws,
              ctx,
              monitors: args.monitors,
              t,
            })
          : await (async () => {
              const probed = await probe(
                action,
                ctx,
                internal.rng.fork(`step:${t}`)
              );
              if (!probed.enabled) throw new ActionNotEnabled(action.name);
              return checkpoint({
                action,
                probed,
                ctx,
                monitors: args.monitors,
                t,
              });
            })();
      transitions.push(result.transition);
      choices.push(result.choice);
      if (result.violations.length > 0) throw result.violations[0]!;
    },
    async observe(o) {
      return (await resolveObservation(
        o as Observation<S, JsonValue>,
        internal.ctx()
      )) as never;
    },
    async assert(p) {
      await assertOnce(p, internal.ctx(), internal.step);
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

export async function start<S>(
  system: System<S>,
  opts: StartOptions<S>
): Promise<Run<S>> {
  const host = opts.host ?? virtualHost();
  const session = await host.open(opts.seed);
  const systemDraws: number[] = [];
  const memo = new Map<string, JsonValue>();
  const genCtx: DriveContext<S> = {
    surface: null as unknown as S,
    session,
    memo,
    rng: recordingRng(session.ports.rng.fork('system'), systemDraws),
    ...(opts.draws !== undefined
      ? { scripted: createScriptedDraws(opts.draws) }
      : { recordDraws: systemDraws }),
  };
  if (opts.draws !== undefined) systemDraws.length = 0;

  const surface = (await drive(
    system.generate(session) as never,
    'generate',
    genCtx
  )) as S;

  const monitors: MonitorState[] = (opts.properties ?? []).map((p) => ({
    property: p as Property<unknown>,
    body: p.watch() as MonitorState['body'],
    pending: null,
    closed: false,
  }));

  await bootMonitors(monitors);
  const v0 = await resumeMonitors(
    monitors,
    {
      surface,
      session,
      memo,
      rng: session.ports.rng.fork('actions'),
    } as DriveContext<unknown>,
    0
  );
  if (v0.length > 0) throw v0[0]!;

  return buildRun({
    surface,
    session,
    system,
    systemDraws,
    memo,
    monitors,
    actionRng: session.ports.rng.fork('actions'),
  });
}

export { ActionNotEnabled, finishProbed, PropertyViolation, probe };
