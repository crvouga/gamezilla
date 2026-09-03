import type { JsonValue, Observation, Run } from '@pkgs/dst';
import type { SyncSurface } from '../../../sim/scenario';
import { passTime } from '../../../sim/scenario';

export type UntilAcmeOpts = {
  /** Virtual-time step per poll (default 25). */
  readonly stepMs?: number;
  /** Max virtual time to wait (default 5_000). */
  readonly maxMs?: number;
  /** Predicate; defaults to truthiness of the observation value. */
  readonly pred?: (value: JsonValue) => boolean;
};

/**
 * Poll `observation` across `passTime` checkpoints until it holds. The sync
 * budget is wide on purpose — hydrate, upload, and pubsub fanout each need a
 * scheduler slice.
 */
export async function untilAcme<T extends JsonValue>(
  run: Run<SyncSurface>,
  observation: Observation<SyncSurface, T>,
  opts?: UntilAcmeOpts
): Promise<JsonValue> {
  const stepMs = opts?.stepMs ?? 25;
  const maxMs = opts?.maxMs ?? 5_000;
  const pred = opts?.pred ?? ((v: JsonValue) => Boolean(v));
  for (let waited = 0; ; waited += stepMs) {
    const value = await run.observe(observation);
    if (pred(value)) return value;
    if (waited >= maxMs) {
      throw new Error(
        `untilAcme: timed out after ${String(maxMs)}ms waiting for '${observation.name}'`
      );
    }
    await run.apply(passTime, stepMs);
  }
}

export type NeverAcmeOpts = {
  /** Virtual-time window the observation must stay falsy for. */
  readonly forMs: number;
  /** Virtual-time step per poll (default 25). */
  readonly stepMs?: number;
  /** Predicate; defaults to truthiness of the observation value. */
  readonly pred?: (value: JsonValue) => boolean;
};

/**
 * Negative counterpart of {@link untilAcme}: advance `forMs` and fail if the
 * observation ever holds. Pins a "must not leak" window, not a timeout.
 */
export async function neverAcme<T extends JsonValue>(
  run: Run<SyncSurface>,
  observation: Observation<SyncSurface, T>,
  opts: NeverAcmeOpts
): Promise<void> {
  const stepMs = opts.stepMs ?? 25;
  const pred = opts.pred ?? ((v: JsonValue) => Boolean(v));
  for (let waited = 0; ; waited += stepMs) {
    if (pred(await run.observe(observation))) {
      throw new Error(
        `neverAcme violated: '${observation.name}' held after ${String(waited)}ms`
      );
    }
    if (waited >= opts.forMs) return;
    await run.apply(passTime, stepMs);
  }
}
