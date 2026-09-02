import type {
  EventuallyOptions,
  Network,
  NeverOptions,
  WorldPorts,
} from '@pkgs/dst';

import type { SimPollablePromise } from './client-surface';

export type { EventuallyOptions, NeverOptions };

export type UntilTarget =
  | (() => boolean | Promise<boolean>)
  | Promise<unknown>
  | SimPollablePromise<unknown>;

type WaitWorld = {
  readonly seed: bigint;
  readonly ports: WorldPorts;
  readonly network: Network;
};

type WaitUntilOpts = EventuallyOptions & {
  readonly budgetMs?: number;
  readonly stepMs?: number;
};

function isSimPollable(value: unknown): value is SimPollablePromise<unknown> {
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

function heldSummary(world: WaitWorld): readonly string[] {
  return [...world.network.held()].sort();
}

/**
 * Sync-aware wait: pollable promises (`client.outcome()`), plain promises
 * (`sub.ready`), and predicates. Framework `World.until` is predicate-only.
 */
export async function waitUntil(
  world: WaitWorld,
  target: UntilTarget,
  opts?: WaitUntilOpts
): Promise<number> {
  const withinMs = opts?.withinMs ?? opts?.budgetMs ?? 2_000;
  const stepMs = opts?.stepMs ?? 25;
  const simClock = world.ports.scheduler.clock;
  const { scheduler } = world.ports;
  const start = simClock.now();
  const watch = watchTarget(target);

  if (await watch.ready()) {
    await watch.settle();
    return simClock.now();
  }

  const steps = Math.max(1, Math.ceil(withinMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await scheduler.runFor(stepMs);
    if (await watch.ready()) {
      await watch.settle();
      return simClock.now();
    }
    if (simClock.now() - start >= withinMs) break;
  }

  const held = heldSummary(world);
  throw new Error(
    `waitUntil timed out seed=${world.seed.toString(16)} now=${simClock.now()} ` +
      `withinMs=${withinMs} pendingEvents=${scheduler.pendingTaskCount()} ` +
      `held=${held.length > 0 ? held.join(',') : 'none'}`
  );
}

/** Advance virtual time for `forMs` and fail if `target` becomes true. */
export async function waitNever(
  world: WaitWorld,
  target: UntilTarget,
  opts: NeverOptions
): Promise<void> {
  const forMs = opts.forMs;
  const stepMs = 25;
  const simClock = world.ports.scheduler.clock;
  const { scheduler } = world.ports;
  const start = simClock.now();
  const watch = watchTarget(target);

  if (await watch.ready()) {
    await watch.settle();
    throw new Error(
      `waitNever violated seed=${world.seed.toString(16)} now=${simClock.now()} ` +
        `forMs=${forMs} (target true before window)`
    );
  }

  const steps = Math.max(1, Math.ceil(forMs / stepMs));
  for (let i = 0; i < steps; i += 1) {
    await scheduler.runFor(stepMs);
    if (await watch.ready()) {
      await watch.settle();
      const held = heldSummary(world);
      throw new Error(
        `waitNever violated seed=${world.seed.toString(16)} now=${simClock.now()} ` +
          `forMs=${forMs} pendingEvents=${scheduler.pendingTaskCount()} ` +
          `held=${held.length > 0 ? held.join(',') : 'none'}`
      );
    }
    if (simClock.now() - start >= forMs) return;
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
