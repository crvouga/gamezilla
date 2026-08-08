import type { SimClock } from './clock';
import type { SimScheduler } from './scheduler';

export type UntilOpts = {
  readonly budgetMs?: number;
  readonly stepMs?: number;
};

export type UntilTarget = Promise<unknown> | (() => boolean | Promise<boolean>);

/** Brand for promises that resolve when a sim poll sees a terminal condition. */
export type SimPollablePromise<T> = Promise<T> & {
  readonly __simPoll: () => Promise<boolean>;
};

export function isSimPollable(
  value: unknown
): value is SimPollablePromise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SimPollablePromise<unknown>).__simPoll === 'function'
  );
}

export type UntilContext = {
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
  readonly seed: bigint;
  readonly heldSummary: () => readonly string[];
};

async function targetReady(target: UntilTarget): Promise<boolean> {
  if (typeof target === 'function') {
    return Boolean(await target());
  }
  if (isSimPollable(target)) {
    return target.__simPoll();
  }
  return false;
}

function promiseSettledFlag(target: Promise<unknown>): {
  readonly done: () => boolean;
  readonly settled: Promise<unknown>;
} {
  let done = false;
  const settled = Promise.resolve(target).finally(() => {
    done = true;
  });
  return { done: () => done, settled };
}

/** Predicate true when every target is ready. */
export function untilAll(...targets: UntilTarget[]): () => Promise<boolean> {
  return async () => {
    for (const t of targets) {
      if (!(await targetReady(t))) return false;
    }
    return true;
  };
}

/** Predicate true when any target is ready. */
export function untilAny(...targets: UntilTarget[]): () => Promise<boolean> {
  return async () => {
    for (const t of targets) {
      if (await targetReady(t)) return true;
    }
    return false;
  };
}

/**
 * Advance virtual time until `target` is satisfied. Returns completion timestamp.
 * Never uses wall-clock; steps by `stepMs` (default 25).
 */
export async function runWorldUntil(
  ctx: UntilContext,
  target: UntilTarget,
  opts?: UntilOpts
): Promise<number> {
  const budgetMs = opts?.budgetMs ?? 2_000;
  const stepMs = opts?.stepMs ?? 25;
  const start = ctx.clock.now();

  let awaitable: Promise<unknown> | null = null;
  let plainDone: (() => boolean) | null = null;
  if (typeof target !== 'function' && !isSimPollable(target)) {
    const flag = promiseSettledFlag(target);
    awaitable = flag.settled;
    plainDone = flag.done;
  } else if (typeof target !== 'function') {
    awaitable = target;
  }

  const ready = async (): Promise<boolean> => {
    if (plainDone !== null) return plainDone();
    return targetReady(target);
  };

  if (await ready()) {
    if (awaitable !== null) await awaitable;
    return ctx.clock.now();
  }

  const steps = Math.max(1, Math.ceil(budgetMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await ctx.scheduler.runFor(stepMs);
    if (await ready()) {
      if (awaitable !== null) await awaitable;
      return ctx.clock.now();
    }
    if (ctx.clock.now() - start >= budgetMs) break;
  }

  const held = ctx.heldSummary();
  throw new Error(
    `until timed out seed=${ctx.seed.toString(16)} now=${ctx.clock.now()} ` +
      `budgetMs=${budgetMs} pendingEvents=${ctx.scheduler.pendingCount()} ` +
      `held=${held.length > 0 ? held.join(',') : 'none'}`
  );
}
