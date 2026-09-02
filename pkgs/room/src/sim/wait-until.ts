import type { NeverOptions, Scheduler, WaitUntilOptions } from '@pkgs/dst';

/** Poll target for room kit wait helpers — predicates only. */
export type UntilPredicate = () => boolean | Promise<boolean>;

export type { NeverOptions, WaitUntilOptions };

type WaitWorld = {
  readonly seed: bigint;
  readonly ports: { readonly scheduler: Scheduler };
  readonly advance: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly flushBeforePoll?: () => Promise<void>;
  readonly heldSummary?: () => readonly string[];
};

function withFlush(world: WaitWorld, pred: UntilPredicate): UntilPredicate {
  return async () => {
    if (world.flushBeforePoll !== undefined) {
      await world.flushBeforePoll();
    }
    return Boolean(await pred());
  };
}

/**
 * Advance virtual time until `pred` is true. Returns completion timestamp.
 * Room-aware: optional aux IO flush before each poll (loopback transports).
 */
export async function waitUntil(
  world: WaitWorld,
  pred: UntilPredicate,
  opts?: WaitUntilOptions & {
    readonly budgetMs?: number;
    readonly stepMs?: number;
  }
): Promise<number> {
  const withinMs = opts?.withinMs ?? opts?.budgetMs ?? 2_000;
  const stepMs = opts?.stepMs ?? 25;
  const simClock = world.ports.scheduler.clock;
  const { scheduler } = world.ports;
  const start = simClock.now();
  const target = withFlush(world, pred);

  if (await target()) {
    return simClock.now();
  }

  const steps = Math.max(1, Math.ceil(withinMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await scheduler.runFor(stepMs);
    if (await target()) {
      return simClock.now();
    }
    if (simClock.now() - start >= withinMs) break;
  }

  const held = world.heldSummary?.() ?? [];
  throw new Error(
    `waitUntil timed out seed=${world.seed.toString(16)} now=${simClock.now()} ` +
      `withinMs=${withinMs} pendingEvents=${scheduler.pendingTaskCount()} ` +
      `held=${held.length > 0 ? held.join(',') : 'none'}`
  );
}

/** Advance virtual time for `forMs` and fail if `pred` becomes true. */
export async function waitNever(
  world: WaitWorld,
  pred: UntilPredicate,
  opts: NeverOptions & { readonly stepMs?: number }
): Promise<void> {
  const forMs = opts.forMs;
  const stepMs = opts.stepMs ?? 25;
  const simClock = world.ports.scheduler.clock;
  const { scheduler } = world.ports;
  const start = simClock.now();
  const target = withFlush(world, pred);

  if (await target()) {
    throw new Error(
      `waitNever violated seed=${world.seed.toString(16)} now=${simClock.now()} ` +
        `forMs=${forMs} (target true before window)`
    );
  }

  const steps = Math.max(1, Math.ceil(forMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await scheduler.runFor(stepMs);
    if (await target()) {
      const held = world.heldSummary?.() ?? [];
      throw new Error(
        `waitNever violated seed=${world.seed.toString(16)} now=${simClock.now()} ` +
          `forMs=${forMs} pendingEvents=${scheduler.pendingTaskCount()} ` +
          `held=${held.length > 0 ? held.join(',') : 'none'}`
      );
    }
    if (simClock.now() - start >= forMs) return;
  }
}
