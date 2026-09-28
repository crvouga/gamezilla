import type { JsonValue, Read, Run } from '@pkgs/harness';
import type { SyncHarness } from '../scenario';

/** Sync default step — hydrate / upload / pubsub each need a scheduler slice. */
const EXAMPLE_STEP_MS = 25;

export type UntilExampleOpts = {
  readonly stepMs?: number;
  readonly maxMs?: number;
  readonly pred?: (value: JsonValue) => boolean;
};

export type NeverExampleOpts = {
  readonly forMs: number;
  readonly stepMs?: number;
  readonly pred?: (value: JsonValue) => boolean;
};

/**
 * Thin example defaults over `s.until`. Prefer calling dst directly with a
 * zero-arg read (or wrap args: `s.until((s) => liveNote(s, id, n))`).
 */
export async function untilExample<T extends JsonValue>(
  s: Run<SyncHarness>,
  read: Read<SyncHarness, [], T>,
  opts?: UntilExampleOpts
): Promise<T> {
  return s.until(read, {
    stepMs: opts?.stepMs ?? EXAMPLE_STEP_MS,
    ...(opts?.maxMs !== undefined ? { maxMs: opts.maxMs } : {}),
    ...(opts?.pred !== undefined
      ? { pred: opts.pred as (t: T) => boolean }
      : {}),
  });
}

/** Thin example defaults over `s.never`. Prefer calling dst directly. */
export async function neverExample<T extends JsonValue>(
  s: Run<SyncHarness>,
  read: Read<SyncHarness, [], T>,
  opts: NeverExampleOpts
): Promise<void> {
  return s.never(read, {
    forMs: opts.forMs,
    stepMs: opts.stepMs ?? EXAMPLE_STEP_MS,
    ...(opts.pred !== undefined
      ? { pred: opts.pred as (t: T) => boolean }
      : {}),
  });
}
