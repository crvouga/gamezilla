import type { Network } from '@pkgs/harness-shared/network-state';
import type { Scheduler as VirtualScheduler } from '@pkgs/harness-shared/scheduler';

import type { HarnessPollablePromise } from './decorate-harness-client';

export type WaitUntilOptions = { readonly withinMs?: number };
export type NeverOptions = { readonly forMs: number };

export type UntilTarget =
  | (() => boolean | Promise<boolean>)
  | Promise<unknown>
  | HarnessPollablePromise<unknown>;

type WaitKit = {
  readonly seed: bigint;
  readonly scheduler: VirtualScheduler;
  readonly network: Network | { readonly held: () => readonly string[] };
};

type WaitUntilOpts = WaitUntilOptions & {
  readonly budgetMs?: number;
  readonly stepMs?: number;
};

function isHarnessPollable(
  value: unknown
): value is HarnessPollablePromise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as HarnessPollablePromise<unknown>).__harnessPoll ===
      'function'
  );
}

async function targetReady(target: UntilTarget): Promise<boolean> {
  if (typeof target === 'function') {
    return Boolean(await target());
  }
  if (isHarnessPollable(target)) {
    return target.__harnessPoll();
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
  if (typeof target !== 'function' && !isHarnessPollable(target)) {
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

function heldSummary(surface: WaitKit): readonly string[] {
  return [...surface.network.held()].sort();
}

/**
 * Sync-aware wait: pollable promises (`client.outcome()`), plain promises
 * (`sub.ready`), and predicates.
 */
export async function waitUntil(
  surface: WaitKit,
  target: UntilTarget,
  opts?: WaitUntilOpts
): Promise<number> {
  const withinMs = opts?.withinMs ?? opts?.budgetMs ?? 2_000;
  const stepMs = opts?.stepMs ?? 25;
  const { scheduler } = surface;
  const harnessClock = scheduler.clock;
  const start = harnessClock.now();
  const watch = watchTarget(target);

  if (await watch.ready()) {
    await watch.settle();
    return harnessClock.now();
  }

  const steps = Math.max(1, Math.ceil(withinMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await scheduler.runFor(stepMs);
    if (await watch.ready()) {
      await watch.settle();
      return harnessClock.now();
    }
    if (harnessClock.now() - start >= withinMs) break;
  }

  const held = heldSummary(surface);
  throw new Error(
    `waitUntil timed out seed=${surface.seed.toString(16)} now=${harnessClock.now()} ` +
      `withinMs=${withinMs} pendingEvents=${scheduler.pendingTaskCount()} ` +
      `held=${held.length > 0 ? held.join(',') : 'none'}`
  );
}

/** Advance virtual time for `forMs` and fail if `target` becomes true. */
export async function waitNever(
  surface: WaitKit,
  target: UntilTarget,
  opts: NeverOptions
): Promise<void> {
  const forMs = opts.forMs;
  const stepMs = 25;
  const { scheduler } = surface;
  const harnessClock = scheduler.clock;
  const start = harnessClock.now();
  const watch = watchTarget(target);

  if (await watch.ready()) {
    await watch.settle();
    throw new Error(
      `waitNever violated seed=${surface.seed.toString(16)} now=${harnessClock.now()} ` +
        `forMs=${forMs} (target true before window)`
    );
  }

  const steps = Math.max(1, Math.ceil(forMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await scheduler.runFor(stepMs);
    if (await watch.ready()) {
      await watch.settle();
      const held = heldSummary(surface);
      throw new Error(
        `waitNever violated seed=${surface.seed.toString(16)} now=${harnessClock.now()} ` +
          `forMs=${forMs} pendingEvents=${scheduler.pendingTaskCount()} ` +
          `held=${held.length > 0 ? held.join(',') : 'none'}`
      );
    }
    if (harnessClock.now() - start >= forMs) return;
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
