import { currentInvariantSink } from './sink';

export function always(id: string, condition: boolean, at: number): void {
  if (!condition) {
    throw new Error(`invariant.always(${id}): failed at ${at}`);
  }
  currentInvariantSink().recordAlways(id, at);
}

export function sometimes(id: string, condition: boolean, at: number): void {
  if (condition) {
    currentInvariantSink().recordSometimes(id, at);
  }
}

export function reachable(id: string, at: number, details?: string): void {
  currentInvariantSink().recordReachable(id, at, details);
}

export function unreachable(
  id: string,
  at: number,
  lazyDetails?: () => string
): void {
  const details = lazyDetails?.();
  currentInvariantSink().recordUnreachable(id, at, details);
  throw new Error(
    `invariant.unreachable(${id}): reached forbidden state at ${at}${
      details !== undefined ? `: ${details}` : ''
    }`
  );
}
