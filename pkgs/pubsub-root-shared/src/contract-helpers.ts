import { expect } from 'bun:test';
import type { Clock, Timers } from '@pkgs/clock-shared/types';

import type { PubSub } from './interface';

let contractClock: Clock | undefined;
let contractTimers: Timers | undefined;

/** Bind wall/virtual clock+timers from the test factory (*.test.ts). */
export function bindContractIo(clock: Clock, timers: Timers): void {
  contractClock = clock;
  contractTimers = timers;
}

function requireTimers(): Timers {
  if (!contractTimers) {
    throw new Error('pubsub contract Io not bound — call bindContractIo');
  }
  return contractTimers;
}

function requireClock(): Clock {
  if (!contractClock) {
    throw new Error('pubsub contract Io not bound — call bindContractIo');
  }
  return contractClock;
}

export function waitMs(ms: number): Promise<void> {
  const timers = requireTimers();
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

export async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 2000,
  intervalMs = 20
): Promise<void> {
  const now = requireClock().now;
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    if (predicate()) return;
    await waitMs(intervalMs);
  }
  throw new Error('waitUntil timed out');
}

export function collect(
  ps: PubSub,
  topic: string
): {
  items: unknown[];
  unsub: () => void;
} {
  const items: unknown[] = [];
  const unsub = ps.subscribe(topic, (data) => {
    items.push(data);
  });
  return { items, unsub };
}

/**
 * Resolve once `ps`'s subscription to `topic` is live at the broker, then
 * clear the probe from `items`. `subscribe` is fire-and-forget; a self-publish
 * travels the subscriber's own connection behind its SUBSCRIBE, so once it
 * echoes back, a publish from any other connection will be delivered instead
 * of dropped for lack of a subscriber.
 */
export async function awaitSubscriptionLive(
  ps: PubSub,
  topic: string,
  items: unknown[]
): Promise<void> {
  const probe = { probe: topic };
  await ps.publish(topic, probe);
  const seen = (): boolean =>
    items.some((item) => JSON.stringify(item) === JSON.stringify(probe));
  await waitUntil(seen, 5000);
  items.length = 0;
}

export async function expectRejects(
  fn: () => unknown | Promise<unknown>
): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  expect('expected throw').toBe('did not throw');
  return undefined;
}
