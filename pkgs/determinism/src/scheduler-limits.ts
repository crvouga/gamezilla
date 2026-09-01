import type { SimClock } from './clock';
import type { Queued } from './scheduler-types';

export function assertIdleBudget(args: {
  readonly steps: number;
  readonly maxSteps: number;
  readonly clock: SimClock;
  readonly start: number;
  readonly maxVirtualMs: number;
}): void {
  if (args.steps >= args.maxSteps) {
    throw new Error(`SimScheduler.runUntilIdle: maxSteps ${args.maxSteps}`);
  }
  if (args.clock.now() - args.start > args.maxVirtualMs) {
    throw new Error(
      `SimScheduler.runUntilIdle: maxVirtualMs ${args.maxVirtualMs}`
    );
  }
}

export function advanceToNextDue(heap: Queued[], clock: SimClock): void {
  if (heap.length === 0) return;
  if (heap[0]!.at > clock.now()) clock.set(heap[0]!.at);
}

export function withinRunUntilBudget(args: {
  readonly steps: number;
  readonly maxSteps: number;
  readonly clock: SimClock;
  readonly start: number;
  readonly maxVirtualMs: number;
}): boolean {
  if (args.steps >= args.maxSteps) return false;
  if (args.clock.now() - args.start > args.maxVirtualMs) return false;
  return true;
}
