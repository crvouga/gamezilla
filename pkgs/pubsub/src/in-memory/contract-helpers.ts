import { expect } from 'bun:test';
import type { Clock, Timers } from '@pkgs/clock';

import type { PubSub } from '../interface';

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
