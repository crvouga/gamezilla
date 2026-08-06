import { expect } from 'bun:test';
import type { PubSub } from '../interface';

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 2000,
  intervalMs = 20
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
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
