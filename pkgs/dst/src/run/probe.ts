import type { JsonValue } from '../kernel/json';
import type { Rng } from '../kernel/rng';
import {
  type Act,
  type Action,
  actFn,
  actWeight,
  type Effect,
  isAct,
  isAction,
  isDraw,
  isObservation,
  type Observation,
} from '../system/effect';
import {
  closeGenerator,
  type DriveContext,
  drive,
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
};

export type ProbeResult<S> = { readonly enabled: false } | EnabledProbe<S>;

/**
 * Probe to the first Act. Per-probe rng; draws buffered. weight 0 / return → disabled.
 */
export async function probe<S>(
  action: Action<S>,
  ctx: DriveContext<S>,
  probeRng: Rng
): Promise<ProbeResult<S>> {
  const draws: number[] = [];
  const rng = recordingFork(probeRng, draws);
  const body = action.generate() as AnyGen;
  return probeBody({ body, ctx, rng, draws, nested: [] });
}

type ProbeBodyArgs<S> = {
  readonly body: AnyGen;
  readonly ctx: DriveContext<S>;
  readonly rng: Rng;
  readonly draws: number[];
  readonly nested: EnabledProbe<S>[];
};

async function probeBody<S>(args: ProbeBodyArgs<S>): Promise<ProbeResult<S>> {
  const { body, ctx, rng, draws, nested } = args;
  let answer: unknown;

  for (;;) {
    const r = await genNext(body, answer);
    if (r.done) {
      await closeGenerator(body);
      return { enabled: false };
    }

    const yielded = r.value as Effect<S>;

    if (isObservation(yielded)) {
      answer = await resolveObservation(
        yielded as Observation<S, JsonValue>,
        ctx
      );
      continue;
    }

    if (isDraw(yielded)) {
      answer =
        ctx.scripted !== undefined ? ctx.scripted.take() : yielded.gen(rng);
      continue;
    }

    if (isAction(yielded)) {
      const inner = await probe(yielded, ctx, rng);
      if (!inner.enabled) {
        await closeGenerator(body);
        return { enabled: false };
      }
      return {
        enabled: true,
        weight: inner.weight,
        act: inner.act,
        draws: [...draws, ...inner.draws],
        body,
        nested: [...nested, inner],
      };
    }

    if (isAct<S>(yielded)) {
      const weight = actWeight(yielded);
      if (!(weight > 0)) {
        await closeGenerator(body);
        return { enabled: false };
      }
      return {
        enabled: true,
        weight,
        act: yielded,
        draws,
        body,
        nested,
      };
    }

    await closeGenerator(body);
    throw new Error('probe: unexpected yield');
  }
}

/**
 * Perform the first act (+ nested finishes for delegates), then drive to end.
 */
export async function finishProbed<S>(
  p: EnabledProbe<S>,
  ctx: DriveContext<S>
): Promise<void> {
  // Finish deepest nested first (the actual first act lives there)
  if (p.nested.length > 0) {
    const inner = p.nested[p.nested.length - 1]!;
    await finishProbed(inner, ctx);
    // Sync draws
    for (const d of inner.draws) {
      if (!p.draws.includes(d)) p.draws.push(d);
    }
    // Resume outer past the Action yield
    await continueBody(p.body, ctx, p.draws);
    return;
  }

  await Promise.resolve(actFn(p.act)(ctx.surface));
  await ctx.session.settle();
  ctx.memo.clear();
  await continueBody(p.body, ctx, p.draws);
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
    if (r.done) return;

    const yielded = r.value as Effect<S>;

    if (isObservation(yielded)) {
      answer = await resolveObservation(
        yielded as Observation<S, JsonValue>,
        ctx
      );
      continue;
    }

    if (isDraw(yielded)) {
      answer =
        ctx.scripted !== undefined ? ctx.scripted.take() : yielded.gen(rng);
      continue;
    }

    if (isAction(yielded)) {
      await drive(yielded.generate(), 'action', {
        ...ctx,
        rng,
        recordDraws: draws,
      });
      answer = undefined;
      continue;
    }

    if (isAct<S>(yielded)) {
      await Promise.resolve(actFn(yielded)(ctx.surface));
      await ctx.session.settle();
      ctx.memo.clear();
      answer = undefined;
      continue;
    }

    throw new Error('continueBody: unexpected yield');
  }
}
