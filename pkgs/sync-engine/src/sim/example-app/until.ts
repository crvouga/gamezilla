import type { JsonValue, Read, Script } from '@pkgs/dst';
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
 * Thin acme defaults over `s.until`. Prefer calling dst directly with a
 * zero-arg read (or wrap args: `s.until((s) => liveNote(s, id, n))`).
 */
export async function untilAcme<T extends JsonValue>(
  s: Script<SyncSurface>,
  read: Read<SyncSurface, [], T>,
  opts?: UntilAcmeOpts
): Promise<T> {
  return s.until(read, {
    stepMs: opts?.stepMs ?? ACME_STEP_MS,
    ...(opts?.maxMs !== undefined ? { maxMs: opts.maxMs } : {}),
    ...(opts?.pred !== undefined
      ? { pred: opts.pred as (t: T) => boolean }
      : {}),
  });
}

/** Thin acme defaults over `s.never`. Prefer calling dst directly. */
export async function neverAcme<T extends JsonValue>(
  s: Script<SyncSurface>,
  read: Read<SyncSurface, [], T>,
  opts: NeverAcmeOpts
): Promise<void> {
  return s.never(read, {
    forMs: opts.forMs,
    stepMs: opts.stepMs ?? ACME_STEP_MS,
    ...(opts.pred !== undefined
      ? { pred: opts.pred as (t: T) => boolean }
      : {}),
  });
}
