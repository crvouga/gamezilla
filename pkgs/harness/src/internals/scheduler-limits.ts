import type { VirtualClock } from './clock';
import type { Task } from './scheduler-types';

export function assertQuiescentBudget(args: {
  readonly steps: number;
  readonly maxSteps: number;
  readonly clock: VirtualClock;
  readonly start: number;
  readonly maxVirtualMs: number;
}): void {
  if (args.steps >= args.maxSteps) {
    throw new Error(`Scheduler.runUntilQuiescent: maxSteps ${args.maxSteps}`);
  }
  if (args.clock.now() - args.start > args.maxVirtualMs) {
    throw new Error(
      `Scheduler.runUntilQuiescent: maxVirtualMs ${args.maxVirtualMs}`
    );
  }
}

export function advanceToNextDue(heap: Task[], clock: VirtualClock): void {
  if (heap.length === 0) return;
  if (heap[0]!.at > clock.now()) clock.set(heap[0]!.at);
}

export function withinRunUntilBudget(args: {
  readonly steps: number;
  readonly maxSteps: number;
  readonly clock: VirtualClock;
  readonly start: number;
  readonly maxVirtualMs: number;
}): boolean {
  if (args.steps >= args.maxSteps) return false;
  if (args.clock.now() - args.start > args.maxVirtualMs) return false;
  return true;
}

/** The labels still pending, hottest first — the storm's likely source. */
function describeHeap(heap: readonly Task[]): string {
  const counts = new Map<string, number>();
  for (const task of heap) {
    counts.set(task.label, (counts.get(task.label) ?? 0) + 1);
  }
  const top = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => `${label}\u00d7${String(count)}`)
    .join(', ');
  return top.length > 0 ? top : '(none)';
}

/** Fired-Task ceiling for one top-level drain (`runFor` / `waitForIdle`). */
export const MAX_DRAIN_STEPS = 100_000;

/** Fired-Task counter for one top-level drain. */
export type DrainBudget = { steps: number };

/**
 * Every drain path fires Tasks through `fireOneDue`, so counting there is what
 * bounds all of them. A Task that reschedules itself at the same virtual
 * instant never moves the clock, and before this budget the drain spun
 * forever: the process pinned a core, allocated, and no per-test timeout could
 * preempt it. Fail with the pending labels instead.
 */
export function assertDrainBudget(
  budget: DrainBudget,
  heap: readonly Task[]
): void {
  if (budget.steps < MAX_DRAIN_STEPS) return;
  throw new Error(
    `Scheduler: drain fired ${String(MAX_DRAIN_STEPS)} tasks without settling — ` +
      'a task is rescheduling itself at the same virtual instant. ' +
      `Pending: ${describeHeap(heap)}`
  );
}
