import type {
  NeverOpts,
  SimClock,
  SimScheduler,
  UntilOpts,
} from '@pkgs/determinism';

export type { NeverOpts, UntilOpts };

/** Promise brand used by sync client.outcome() — polled each until step. */
export type SimPollablePromise<T> = Promise<T> & {
  readonly __simPoll: () => Promise<boolean>;
};

export type UntilTarget =
  | (() => boolean | Promise<boolean>)
  | Promise<unknown>
  | SimPollablePromise<unknown>;

export type UntilContext = {
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
  readonly seed: bigint;
  readonly heldSummary?: () => readonly string[];
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

type TargetWatch = {
  readonly ready: () => Promise<boolean>;
  readonly settle: () => Promise<void>;
};

function watchTarget(target: UntilTarget): TargetWatch {
  let awaitable: Promise<unknown> | null = null;
  let plainDone: (() => boolean) | null = null;
  if (typeof target !== 'function' && !isSimPollable(target)) {
    const flag = promiseSettledFlag(target);
    awaitable = flag.settled;
    plainDone = flag.done;
  } else if (typeof target !== 'function') {
    awaitable = target;
  }

  return {
    ready: async () => {
      if (plainDone !== null) return plainDone();
      return targetReady(target);
    },
    settle: (): Promise<void> => {
      if (awaitable === null) return Promise.resolve();
      return awaitable.then(() => undefined);
    },
  };
}

/**
 * Advance virtual time until `target` is satisfied. Returns completion
 * timestamp. Sync-local: framework `World.until` is predicate-only; the
 * pollable-promise targets (`client.outcome()`) live here.
 */
export async function until(
  ctx: UntilContext,
  target: UntilTarget,
  opts?: UntilOpts
): Promise<number> {
  const budgetMs = opts?.budgetMs ?? 2_000;
  const stepMs = opts?.stepMs ?? 25;
  const start = ctx.clock.now();
  const watch = watchTarget(target);

  if (await watch.ready()) {
    await watch.settle();
    return ctx.clock.now();
  }

  const steps = Math.max(1, Math.ceil(budgetMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await ctx.scheduler.runFor(stepMs);
    if (await watch.ready()) {
      await watch.settle();
      return ctx.clock.now();
    }
    if (ctx.clock.now() - start >= budgetMs) break;
  }

  const held = ctx.heldSummary?.() ?? [];
  throw new Error(
    `until timed out seed=${ctx.seed.toString(16)} now=${ctx.clock.now()} ` +
      `budgetMs=${budgetMs} pendingEvents=${ctx.scheduler.pendingCount()} ` +
      `held=${held.length > 0 ? held.join(',') : 'none'}`
  );
}

/**
 * Advance virtual time for `forMs` and fail if `target` becomes true.
 */
export async function never(
  ctx: UntilContext,
  target: UntilTarget,
  opts: NeverOpts
): Promise<void> {
  const forMs = opts.forMs;
  const stepMs = opts.stepMs ?? 25;
  const start = ctx.clock.now();
  const watch = watchTarget(target);

  if (await watch.ready()) {
    await watch.settle();
    throw new Error(
      `never violated seed=${ctx.seed.toString(16)} now=${ctx.clock.now()} ` +
        `forMs=${forMs} (target true before window)`
    );
  }

  const steps = Math.max(1, Math.ceil(forMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await ctx.scheduler.runFor(stepMs);
    if (await watch.ready()) {
      await watch.settle();
      const held = ctx.heldSummary?.() ?? [];
      throw new Error(
        `never violated seed=${ctx.seed.toString(16)} now=${ctx.clock.now()} ` +
          `forMs=${forMs} pendingEvents=${ctx.scheduler.pendingCount()} ` +
          `held=${held.length > 0 ? held.join(',') : 'none'}`
      );
    }
    if (ctx.clock.now() - start >= forMs) return;
  }
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
