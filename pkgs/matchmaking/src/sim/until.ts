/**
 * Virtual-time until / never helpers for the matchmaking sim world.
 */

import type { SimClock } from '@pkgs/clock';

export type UntilOpts = {
  readonly budgetMs?: number;
  readonly stepMs?: number;
};

export type NeverOpts = {
  readonly forMs: number;
  readonly stepMs?: number;
};

export type UntilTarget = () => boolean | Promise<boolean>;

export type MatchmakingUntilContext = {
  readonly clock: SimClock;
  readonly seed: bigint;
  readonly step: (ms: number) => Promise<void>;
};

async function targetReady(target: UntilTarget): Promise<boolean> {
  return Boolean(await target());
}

function failMsg(
  ctx: MatchmakingUntilContext,
  kind: string,
  detail: string
): string {
  return `${kind} seed=${ctx.seed.toString(16)} now=${String(ctx.clock.now())} ${detail}`;
}

/**
 * Advance virtual time until `target` is satisfied. Returns completion timestamp.
 */
export async function runWorldUntil(
  ctx: MatchmakingUntilContext,
  target: UntilTarget,
  opts?: UntilOpts
): Promise<number> {
  const budgetMs = opts?.budgetMs ?? 2_000;
  const stepMs = opts?.stepMs ?? 25;
  const start = ctx.clock.now();
  while (ctx.clock.now() - start <= budgetMs) {
    if (await targetReady(target)) return ctx.clock.now();
    await ctx.step(stepMs);
  }
  throw new Error(
    failMsg(ctx, 'until timeout', `budgetMs=${String(budgetMs)}`)
  );
}

/** Fail if target becomes true within `forMs` (scheduler-driven). */
export async function runWorldNever(
  ctx: MatchmakingUntilContext,
  target: UntilTarget,
  opts: NeverOpts
): Promise<void> {
  const stepMs = opts.stepMs ?? 25;
  const start = ctx.clock.now();
  while (ctx.clock.now() - start < opts.forMs) {
    if (await targetReady(target)) {
      throw new Error(
        failMsg(
          ctx,
          'never violated',
          `forMs=${String(opts.forMs)} elapsed=${String(ctx.clock.now() - start)}`
        )
      );
    }
    const remain = opts.forMs - (ctx.clock.now() - start);
    await ctx.step(Math.min(stepMs, Math.max(1, remain)));
  }
}
