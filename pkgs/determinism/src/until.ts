import type { SimClock } from './clock';
import type { SimScheduler } from './scheduler';

export type UntilOpts = {
  readonly budgetMs?: number;
  readonly stepMs?: number;
};

export type NeverOpts = {
  readonly forMs: number;
  readonly stepMs?: number;
};

export type UntilContext = {
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
  readonly seed: bigint;
  readonly heldSummary?: () => readonly string[];
};

/**
 * Advance virtual time until `pred` is true. Returns completion timestamp.
 */
export async function until(
  ctx: UntilContext,
  pred: () => boolean | Promise<boolean>,
  opts?: UntilOpts
): Promise<number> {
  const budgetMs = opts?.budgetMs ?? 2_000;
  const stepMs = opts?.stepMs ?? 25;
  const start = ctx.clock.now();

  if (await pred()) {
    return ctx.clock.now();
  }

  const steps = Math.max(1, Math.ceil(budgetMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await ctx.scheduler.runFor(stepMs);
    if (await pred()) {
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
 * Advance virtual time for `forMs` and fail if `pred` becomes true.
 */
export async function never(
  ctx: UntilContext,
  pred: () => boolean | Promise<boolean>,
  opts: NeverOpts
): Promise<void> {
  const forMs = opts.forMs;
  const stepMs = opts.stepMs ?? 25;
  const start = ctx.clock.now();

  if (await pred()) {
    throw new Error(
      `never violated seed=${ctx.seed.toString(16)} now=${ctx.clock.now()} ` +
        `forMs=${forMs} (target true before window)`
    );
  }

  const steps = Math.max(1, Math.ceil(forMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await ctx.scheduler.runFor(stepMs);
    if (await pred()) {
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
