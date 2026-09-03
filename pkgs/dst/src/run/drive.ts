import type { Session } from '../host/types';
import type { JsonValue } from '../kernel/json';
import type { Rng, ScriptedDraws } from '../kernel/rng';
import {
  type Act,
  actFn,
  type Effect,
  isAct,
  isAction,
  isDraw,
  isObservation,
  type Observation,
} from '../system/effect';

export type DriveMode = 'generate' | 'observe' | 'action' | 'watch';

export type DriveContext<S> = {
  readonly surface: S;
  readonly session: Session;
  readonly memo: Map<string, JsonValue>;
  readonly rng: Rng;
  readonly scripted?: ScriptedDraws;
  readonly recordDraws?: number[];
};

export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveError';
  }
}

export const STOPPED_AT_ACT = Symbol.for('dst.stoppedAtAct');

type AnyGen<Y, R> = Generator<Y, R, unknown> | AsyncGenerator<Y, R, unknown>;

function isAsyncGen(
  v: AnyGen<unknown, unknown>
): v is AsyncGenerator<unknown, unknown, unknown> {
  return Symbol.asyncIterator in Object(v);
}

async function nextGen<Y, R>(
  body: AnyGen<Y, R>,
  answer: unknown
): Promise<IteratorResult<Y, R>> {
  if (isAsyncGen(body)) {
    return body.next(answer);
  }
  return (body as Generator<Y, R, unknown>).next(answer);
}

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

function runDraw<P>(gen: (rng: Rng) => P, ctx: DriveContext<unknown>): P {
  if (ctx.scripted !== undefined) {
    return ctx.scripted.take() as P;
  }
  if (ctx.recordDraws !== undefined) {
    return gen(recordingRng(ctx.rng, ctx.recordDraws));
  }
  return gen(ctx.rng);
}

export async function resolveObservation<S>(
  o: Observation<S, JsonValue>,
  ctx: DriveContext<S>
): Promise<JsonValue> {
  const cached = ctx.memo.get(o.name);
  if (cached !== undefined) return cached;

  const result = o.observe(ctx.surface);
  let value: JsonValue;

  if (
    typeof result === 'object' &&
    result !== null &&
    typeof (result as { next?: unknown }).next === 'function'
  ) {
    value = (await drive(
      result as AnyGen<Observation<S, JsonValue>, JsonValue>,
      'observe',
      ctx
    )) as JsonValue;
  } else {
    value = (await Promise.resolve(result)) as JsonValue;
  }

  ctx.memo.set(o.name, value);
  return value;
}

export type DriveOpts<S> = {
  readonly stopAtAct?: boolean;
  readonly onFirstAct?: (act: Act<S>) => void;
};

/**
 * Drive a body. Returns the body's return value, or STOPPED_AT_ACT when
 * stopAtAct and the first Act is reached (without performing it).
 */
export async function drive<S, R>(
  body: AnyGen<Effect<S> | Observation<S, JsonValue>, R> | R | Promise<R>,
  mode: DriveMode,
  ctx: DriveContext<S>,
  opts?: DriveOpts<S>
): Promise<R | typeof STOPPED_AT_ACT> {
  if (
    body === null ||
    body === undefined ||
    typeof (body as { next?: unknown }).next !== 'function'
  ) {
    return (await Promise.resolve(body as R | Promise<R>)) as R;
  }

  const gen = body as AnyGen<Effect<S> | Observation<S, JsonValue>, R>;
  let answer: unknown;

  for (;;) {
    const r = await nextGen(gen, answer);
    if (r.done) return r.value;
    const step = await handleYield(r.value, mode, ctx, opts);
    if (step === STOPPED_AT_ACT) return STOPPED_AT_ACT;
    answer = step;
  }
}

async function handleYield<S>(
  yielded: Effect<S> | Observation<S, JsonValue>,
  mode: DriveMode,
  ctx: DriveContext<S>,
  opts?: DriveOpts<S>
): Promise<unknown | typeof STOPPED_AT_ACT> {
  if (isObservation(yielded)) {
    if (mode === 'generate') {
      throw new DriveError('generate body may not yield observations');
    }
    return resolveObservation(yielded as Observation<S, JsonValue>, ctx);
  }
  if (isDraw(yielded)) {
    if (mode !== 'generate' && mode !== 'action') {
      throw new DriveError(`${mode} body may not draw`);
    }
    return runDraw(yielded.gen, ctx as DriveContext<unknown>);
  }
  if (isAction(yielded)) {
    if (mode !== 'action') {
      throw new DriveError(`${mode} body may not delegate to an action`);
    }
    const inner = await drive(yielded.generate(), 'action', ctx, opts);
    if (inner === STOPPED_AT_ACT) return STOPPED_AT_ACT;
    return undefined;
  }
  if (isAct<S>(yielded)) {
    if (mode !== 'action') {
      throw new DriveError(`${mode} body may not act`);
    }
    if (opts?.stopAtAct) {
      opts.onFirstAct?.(yielded);
      return STOPPED_AT_ACT;
    }
    await Promise.resolve(actFn(yielded)(ctx.surface));
    await ctx.session.settle();
    ctx.memo.clear();
    return undefined;
  }
  throw new DriveError(
    `${mode}: unexpected yield ${Object.prototype.toString.call(yielded)}`
  );
}

export async function closeGenerator(
  body: AnyGen<unknown, unknown>
): Promise<unknown> {
  try {
    if (isAsyncGen(body)) {
      const r = await body.return(undefined);
      return r.value;
    }
    return (body as Generator<unknown, unknown, unknown>).return(undefined)
      .value;
  } catch (e) {
    throw e;
  }
}
