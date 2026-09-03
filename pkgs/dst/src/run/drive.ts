import type { Session } from '../host/types';
import type { JsonValue } from '../kernel/json';
import type { Rng } from '../kernel/rng';
import {
  type Act,
  type ActionBody,
  actFn,
  type BoundObservation,
  type Effect,
  isAct,
  isAction,
  isBoundAction,
  isBoundObservation,
  isDraw,
  isObservation,
  type Observation,
  observationMemoKey,
} from '../system/effect';

export type DriveMode = 'generate' | 'observe' | 'action' | 'watch';

export type DriveContext<S> = {
  readonly surface: S;
  readonly session: Session;
  readonly memo: Map<string, JsonValue>;
  readonly rng: Rng;
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
  if (ctx.recordDraws !== undefined) {
    return gen(recordingRng(ctx.rng, ctx.recordDraws));
  }
  return gen(ctx.rng);
}

function isGeneratorLike(v: unknown): v is AnyGen<unknown, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { next?: unknown }).next === 'function'
  );
}

function isAsyncIterable(v: unknown): v is AsyncIterable<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    Symbol.asyncIterator in v &&
    typeof (v as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function'
  );
}

function isSyncIterable(v: unknown): v is Iterable<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !(Symbol.asyncIterator in v) &&
    Symbol.iterator in v &&
    typeof (v as Iterable<unknown>)[Symbol.iterator] === 'function' &&
    !isObservation(v) &&
    !isBoundObservation(v) &&
    !isAction(v) &&
    !isBoundAction(v) &&
    !isDraw(v)
  );
}

async function* iterableToAsyncGen(
  it: Iterable<unknown> | AsyncIterable<unknown>
): AsyncGenerator<unknown, void, unknown> {
  if (isAsyncIterable(it)) {
    for await (const item of it) {
      yield item;
    }
    return;
  }
  for (const item of it) {
    yield item;
  }
}

export async function resolveObservation<S>(
  o: Observation<S, unknown[], JsonValue> | BoundObservation<S, JsonValue>,
  ctx: DriveContext<S>
): Promise<JsonValue> {
  const obs = (isBoundObservation(o) ? o.observation : o) as Observation<
    S,
    unknown[],
    JsonValue
  >;
  const args = isBoundObservation(o) ? o.args : [];
  const key = isBoundObservation(o)
    ? o.name
    : observationMemoKey(obs.name, args);

  const cached = ctx.memo.get(key);
  if (cached !== undefined) return cached;

  const result = obs.observe(ctx.surface, ...args);
  let value: JsonValue;

  if (isGeneratorLike(result)) {
    value = (await drive(
      result as AnyGen<Effect<S>, JsonValue>,
      'observe',
      ctx
    )) as JsonValue;
  } else {
    value = (await Promise.resolve(result)) as JsonValue;
  }

  ctx.memo.set(key, value);
  return value;
}

export type DriveOpts<S> = {
  readonly stopAtAct?: boolean;
  readonly onFirstAct?: (act: Act<S>) => void;
};

/**
 * Normalize an ActionBody into a generator the drive loop can consume.
 * Bare Act / void / Promise wrap into a one-shot generator.
 */
export async function normalizeActionBody<S>(
  body: ActionBody<S>
): Promise<AnyGen<Effect<S>, Act<S> | void>> {
  const resolved = await Promise.resolve(
    body as ActionBody<S> | Promise<ActionBody<S>>
  );
  if (resolved === undefined || resolved === null) {
    return (function* () {})();
  }
  if (isGeneratorLike(resolved)) {
    return resolved as AnyGen<Effect<S>, Act<S> | void>;
  }
  if (isSyncIterable(resolved) || isAsyncIterable(resolved)) {
    return iterableToAsyncGen(resolved) as AsyncGenerator<
      Effect<S>,
      Act<S> | void,
      unknown
    >;
  }
  if (isAct<S>(resolved)) {
    return (function* () {
      yield resolved;
    })();
  }
  throw new DriveError(
    `action body: unexpected return ${Object.prototype.toString.call(resolved)}`
  );
}

/**
 * Drive a body. Returns the body's return value, or STOPPED_AT_ACT when
 * stopAtAct and the first Act is reached (without performing it).
 */
export async function drive<S, R>(
  body: AnyGen<Effect<S>, R> | R | Promise<R>,
  mode: DriveMode,
  ctx: DriveContext<S>,
  opts?: DriveOpts<S>
): Promise<R | typeof STOPPED_AT_ACT> {
  if (!isGeneratorLike(body)) {
    return (await Promise.resolve(body as R | Promise<R>)) as R;
  }

  const gen = body as AnyGen<Effect<S>, R>;
  let answer: unknown;
  let returnAct: Act<S> | undefined;

  for (;;) {
    const r = await nextGen(gen, answer);
    if (r.done) {
      // Generator returned an Act — treat as final yield.
      if (r.value !== undefined && isAct<S>(r.value)) {
        returnAct = r.value;
        break;
      }
      return r.value;
    }
    const step = await handleYield(r.value, mode, ctx, opts);
    if (step === STOPPED_AT_ACT) return STOPPED_AT_ACT;
    answer = step;
  }

  if (returnAct !== undefined) {
    if (mode !== 'action') {
      throw new DriveError(`${mode} body may not act`);
    }
    if (opts?.stopAtAct) {
      opts.onFirstAct?.(returnAct);
      return STOPPED_AT_ACT;
    }
    await Promise.resolve(actFn(returnAct)(ctx.surface));
    await ctx.session.settle();
    ctx.memo.clear();
  }
  return undefined as R;
}

async function driveDelegate<S>(
  mode: DriveMode,
  ctx: DriveContext<S>,
  opts: DriveOpts<S> | undefined,
  body: Awaited<ReturnType<typeof normalizeActionBody<S>>>
): Promise<undefined | typeof STOPPED_AT_ACT> {
  if (mode !== 'action') {
    throw new DriveError(`${mode} body may not delegate to an action`);
  }
  const inner = await drive(body, 'action', ctx, opts);
  if (inner === STOPPED_AT_ACT) return STOPPED_AT_ACT;
  return undefined;
}

async function driveAct<S>(
  yielded: Act<S>,
  mode: DriveMode,
  ctx: DriveContext<S>,
  opts?: DriveOpts<S>
): Promise<undefined | typeof STOPPED_AT_ACT> {
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

async function handleYield<S>(
  yielded: Effect<S>,
  mode: DriveMode,
  ctx: DriveContext<S>,
  opts?: DriveOpts<S>
): Promise<unknown | typeof STOPPED_AT_ACT> {
  if (isObservation(yielded) || isBoundObservation(yielded)) {
    if (mode === 'generate') {
      throw new DriveError('generate body may not yield observations');
    }
    return resolveObservation(yielded, ctx);
  }
  if (isDraw(yielded)) {
    if (mode !== 'generate' && mode !== 'action') {
      throw new DriveError(`${mode} body may not draw`);
    }
    return runDraw(yielded.gen, ctx as DriveContext<unknown>);
  }
  if (isBoundAction(yielded)) {
    return driveDelegate(
      mode,
      ctx,
      opts,
      await normalizeActionBody(yielded.action.generate(...yielded.args))
    );
  }
  if (isAction(yielded)) {
    return driveDelegate(
      mode,
      ctx,
      opts,
      await normalizeActionBody(yielded.generate())
    );
  }
  if (isAct<S>(yielded)) {
    return driveAct(yielded, mode, ctx, opts);
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
