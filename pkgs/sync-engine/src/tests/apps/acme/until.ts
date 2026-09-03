import type { JsonValue, Read, Run } from '@pkgs/dst';
import type { SyncSurface } from '../../../sim/scenario';

/** Sync default step — hydrate / upload / pubsub each need a scheduler slice. */
const ACME_STEP_MS = 25;

export type UntilAcmeOpts = {
  readonly stepMs?: number;
  readonly maxMs?: number;
  readonly pred?: (value: JsonValue) => boolean;
};

export type NeverAcmeOpts = {
  readonly forMs: number;
  readonly stepMs?: number;
  readonly pred?: (value: JsonValue) => boolean;
};

/**
 * Thin acme defaults over `run.until`. Prefer calling dst directly with a
 * zero-arg read (or wrap args: `run.until((s) => liveNote(s, id, n))`).
 */
export async function untilAcme<T extends JsonValue>(
  run: Run<SyncSurface>,
  read: Read<SyncSurface, [], T>,
  opts?: UntilAcmeOpts
): Promise<T> {
  return run.until(read, {
    stepMs: opts?.stepMs ?? ACME_STEP_MS,
    ...(opts?.maxMs !== undefined ? { maxMs: opts.maxMs } : {}),
    ...(opts?.pred !== undefined
      ? { pred: opts.pred as (t: T) => boolean }
      : {}),
  });
}

/** Thin acme defaults over `run.never`. Prefer calling dst directly. */
export async function neverAcme<T extends JsonValue>(
  run: Run<SyncSurface>,
  read: Read<SyncSurface, [], T>,
  opts: NeverAcmeOpts
): Promise<void> {
  return run.never(read, {
    forMs: opts.forMs,
    stepMs: opts.stepMs ?? ACME_STEP_MS,
    ...(opts.pred !== undefined
      ? { pred: opts.pred as (t: T) => boolean }
      : {}),
  });
}
