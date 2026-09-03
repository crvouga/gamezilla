import type { JsonValue } from '../kernel/json';
import type { Rng } from '../kernel/rng';
import {
  type Act,
  type Action,
  actFn,
  actWeight,
  type BoundAction,
  type BoundObservation,
  type Effect,
  isAct,
  isAction,
  isBoundAction,
  isBoundObservation,
  isDraw,
  isObservation,
  type Observation,
} from '../system/effect';
import {
  closeGenerator,
  type DriveContext,
  drive,
  normalizeActionBody,
  resolveObservation,
} from './drive';

export class ActionNotEnabled extends Error {
  readonly action: string;
  constructor(action: string) {
    super(`ActionNotEnabled: '${action}'`);
    this.name = 'ActionNotEnabled';
    this.action = action;
  }
}

type AnyGen =
  | Generator<unknown, void, unknown>
  | AsyncGenerator<unknown, void, unknown>;

type ObsYield<S> =
  | Observation<S, unknown[], JsonValue>
  | BoundObservation<S, JsonValue>;

function isAsync(body: AnyGen): body is AsyncGenerator<unknown, void, unknown> {
  return Symbol.asyncIterator in Object(body);
}

async function genNext(
  body: AnyGen,
  answer: unknown
): Promise<IteratorResult<unknown, void>> {
  if (isAsync(body)) return body.next(answer);
  return (body as Generator<unknown, void, unknown>).next(answer);
}

function recordingFork(base: Rng, draws: number[]): Rng {
  const wrap = (r: Rng): Rng => ({
    next() {
      const v = r.next();
      draws.push(v);
      return v;
    },
    fork(name) {
      return wrap(r.fork(name));
    },
  });
  return wrap(base);
}

export type EnabledProbe<S> = {
  readonly enabled: true;
  readonly weight: number;
  readonly act: Act<S>;
  readonly draws: number[];
  /** Parked generator that has just yielded the first act (not yet resumed). */
  readonly body: AnyGen;
  /** Nested probes to finish before resuming `body` (for yield* delegation). */
  readonly nested: readonly EnabledProbe<S>[];
  readonly args: readonly unknown[];
};

export type ProbeResult<S> = { readonly enabled: false } | EnabledProbe<S>;

/**
 * Probe to the first Act. Per-probe rng; draws buffered. weight 0 / return → disabled.
 */
export async function probe<S>(
  action: Action<S, unknown[]>,
  ctx: DriveContext<S>,
  probeRng: Rng,
  args: readonly unknown[] = []
): Promise<ProbeResult<S>> {
  const draws: number[] = [];
  const rng = recordingFork(probeRng, draws);
  const raw = action.generate(...args);
  const body = (await normalizeActionBody(raw)) as AnyGen;
  return probeBody({ body, ctx, rng, draws, nested: [], args });
}

type ProbeBodyArgs<S> = {
  readonly body: AnyGen;
  readonly ctx: DriveContext<S>;
  readonly rng: Rng;
  readonly draws: number[];
  readonly nested: EnabledProbe<S>[];
  readonly args: readonly unknown[];
};

function enabledFromAct<S>(
  act: Act<S>,
  args: ProbeBodyArgs<S>
): ProbeResult<S> | null {
  const weight = actWeight(act);
  if (!(weight > 0)) return null;
  return {
    enabled: true,
    weight,
    act,
    draws: args.draws,
    body: args.body,
    nested: args.nested,
    args: args.args,
  };
}

async function nestProbe<S>(
  inner: ProbeResult<S>,
  args: ProbeBodyArgs<S>
): Promise<ProbeResult<S>> {
  if (!inner.enabled) {
    await closeGenerator(args.body);
    return { enabled: false };
  }
  return {
    enabled: true,
    weight: inner.weight,
    act: inner.act,
    draws: [...args.draws, ...inner.draws],
    body: args.body,
    nested: [...args.nested, inner],
    args: args.args,
  };
}

async function handleProbeYield<S>(
  yielded: Effect<S>,
  args: ProbeBodyArgs<S>
): Promise<{ kind: 'answer'; value: unknown } | ProbeResult<S>> {
  if (isObservation(yielded) || isBoundObservation(yielded)) {
    return {
      kind: 'answer',
      value: await resolveObservation(yielded as ObsYield<S>, args.ctx),
    };
  }
  if (isDraw(yielded)) {
    return { kind: 'answer', value: yielded.gen(args.rng) };
  }
  if (isBoundAction(yielded)) {
    return nestProbe(
      await probe(yielded.action, args.ctx, args.rng, yielded.args),
      args
    );
  }
  if (isAction(yielded)) {
    return nestProbe(await probe(yielded, args.ctx, args.rng, []), args);
  }
  if (isAct<S>(yielded)) {
    const enabled = enabledFromAct(yielded, args);
    if (enabled === null) {
      await closeGenerator(args.body);
      return { enabled: false };
    }
    return enabled;
  }
  await closeGenerator(args.body);
  throw new Error('probe: unexpected yield');
}

async function probeBody<S>(args: ProbeBodyArgs<S>): Promise<ProbeResult<S>> {
  let answer: unknown;
  for (;;) {
    const r = await genNext(args.body, answer);
    if (r.done) {
      if (r.value !== undefined && isAct<S>(r.value)) {
        const enabled = enabledFromAct(r.value, args);
        if (enabled === null) {
          await closeGenerator(args.body);
          return { enabled: false };
        }
        return enabled;
      }
      await closeGenerator(args.body);
      return { enabled: false };
    }
    const step = await handleProbeYield(r.value as Effect<S>, args);
    if ('kind' in step && step.kind === 'answer') {
      answer = step.value;
      continue;
    }
    return step as ProbeResult<S>;
  }
}

/**
 * Perform the first act (+ nested finishes for delegates), then drive to end.
 */
export async function finishProbed<S>(
  p: EnabledProbe<S>,
  ctx: DriveContext<S>
): Promise<void> {
  if (p.nested.length > 0) {
    const inner = p.nested[p.nested.length - 1]!;
    await finishProbed(inner, ctx);
    for (const d of inner.draws) {
      if (!p.draws.includes(d)) p.draws.push(d);
    }
    await continueBody(p.body, ctx, p.draws);
    return;
  }

  await Promise.resolve(actFn(p.act)(ctx.surface));
  await ctx.session.settle();
  ctx.memo.clear();
  await continueBody(p.body, ctx, p.draws);
}

async function performAct<S>(act: Act<S>, ctx: DriveContext<S>): Promise<void> {
  await Promise.resolve(actFn(act)(ctx.surface));
  await ctx.session.settle();
  ctx.memo.clear();
}

async function continueYield<S>(
  yielded: Effect<S>,
  ctx: DriveContext<S>,
  rng: Rng,
  draws: number[]
): Promise<unknown> {
  if (isObservation(yielded) || isBoundObservation(yielded)) {
    return resolveObservation(yielded as ObsYield<S>, ctx);
  }
  if (isDraw(yielded)) return yielded.gen(rng);
  if (isBoundAction(yielded)) {
    const innerBody = await normalizeActionBody(
      yielded.action.generate(...yielded.args)
    );
    await drive(innerBody, 'action', { ...ctx, rng, recordDraws: draws });
    return undefined;
  }
  if (isAction(yielded)) {
    const innerBody = await normalizeActionBody(yielded.generate());
    await drive(innerBody, 'action', { ...ctx, rng, recordDraws: draws });
    return undefined;
  }
  if (isAct<S>(yielded)) {
    await performAct(yielded, ctx);
    return undefined;
  }
  throw new Error('continueBody: unexpected yield');
}

async function continueBody<S>(
  body: AnyGen,
  ctx: DriveContext<S>,
  draws: number[]
): Promise<void> {
  const rng = recordingFork(ctx.rng, draws);
  let answer: unknown;
  for (;;) {
    const r = await genNext(body, answer);
    if (r.done) {
      if (r.value !== undefined && isAct<S>(r.value)) {
        await performAct(r.value, ctx);
      }
      return;
    }
    answer = await continueYield(r.value as Effect<S>, ctx, rng, draws);
  }
}

export type { BoundAction };
