import type { SimClock } from './clock';
import {
  advanceToNextDue,
  assertIdleBudget,
  withinRunUntilBudget,
} from './scheduler-limits';
import type { Queued, SimTask } from './scheduler-types';

export type { Queued, SimTask };

export function pushQueued(heap: Queued[], item: Queued): void {
  heap.push(item);
  heap.sort((a, b) => a.at - b.at || a.seq - b.seq);
}

export async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 32; i += 1) await Promise.resolve();
}

export async function fireDueEvents(
  heap: Queued[],
  clock: SimClock
): Promise<number> {
  let steps = 0;
  const burstLimit = 10_000;
  for (let round = 0; round < 8; round += 1) {
    let fired = 0;
    while (
      steps < burstLimit &&
      heap.length > 0 &&
      heap[0]!.at <= clock.now()
    ) {
      const next = heap.shift()!;
      await next.run();
      steps += 1;
      fired += 1;
    }
    await flushMicrotasks();
    if (fired === 0) break;
  }
  return steps;
}

export async function runForDuration(
  heap: Queued[],
  clock: SimClock,
  durationMs: number
): Promise<void> {
  const end = clock.now() + Math.max(0, durationMs);
  for (;;) {
    await fireDueEvents(heap, clock);
    if (heap.length === 0) {
      clock.set(end);
      return;
    }
    if (heap[0]!.at > end) {
      clock.set(end);
      return;
    }
    clock.set(heap[0]!.at);
  }
}

export async function runUntilIdleHeap(
  heap: Queued[],
  clock: SimClock,
  opts?: { readonly maxSteps?: number; readonly maxVirtualMs?: number }
): Promise<void> {
  const maxSteps = opts?.maxSteps ?? 100_000;
  const maxVirtualMs = opts?.maxVirtualMs ?? 86_400_000;
  const start = clock.now();
  let steps = 0;
  let idleRounds = 0;
  while (idleRounds < 3) {
    assertIdleBudget({ steps, maxSteps, clock, start, maxVirtualMs });
    if (heap.length === 0) {
      await flushMicrotasks();
      idleRounds = heap.length === 0 ? idleRounds + 1 : 0;
      continue;
    }
    idleRounds = 0;
    advanceToNextDue(heap, clock);
    steps += await fireDueEvents(heap, clock);
  }
}

export async function runUntilPred(
  heap: Queued[],
  clock: SimClock,
  pred: () => boolean | Promise<boolean>,
  opts?: { readonly maxVirtualMs?: number; readonly maxSteps?: number }
): Promise<boolean> {
  if (await pred()) return true;
  const maxSteps = opts?.maxSteps ?? 100_000;
  const maxVirtualMs = opts?.maxVirtualMs ?? 86_400_000;
  const start = clock.now();
  let steps = 0;
  while (heap.length > 0) {
    if (
      !withinRunUntilBudget({ steps, maxSteps, clock, start, maxVirtualMs })
    ) {
      return false;
    }
    advanceToNextDue(heap, clock);
    steps += await fireDueEvents(heap, clock);
    if (await pred()) return true;
  }
  return await pred();
}
