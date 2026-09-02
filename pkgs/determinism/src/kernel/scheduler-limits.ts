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
