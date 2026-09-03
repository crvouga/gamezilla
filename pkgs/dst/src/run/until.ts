import type { JsonValue } from '../kernel/json';
import type { Action, Observation } from '../system/effect';
import type { Run } from './start';

export type UntilObservedOpts = {
  /** Virtual-time step per poll (default 50). */
  readonly stepMs?: number;
  /** Max virtual time to wait (default 5_000). */
  readonly maxMs?: number;
  /** Predicate; defaults to truthiness of the observation value. */
  readonly pred?: (value: JsonValue) => boolean;
};

/**
 * Poll an observation across `passTime` checkpoints until it holds.
 * One checkpoint per poll — observations are memoised per checkpoint.
 */
export async function untilObserved<S>(
  run: Run<S>,
  observation: Observation<S, JsonValue>,
  passTime: Action<S>,
  opts?: UntilObservedOpts
): Promise<JsonValue> {
  const stepMs = opts?.stepMs ?? 50;
  const maxMs = opts?.maxMs ?? 5_000;
  const pred = opts?.pred ?? ((v) => Boolean(v));
  let waited = 0;
  while (true) {
    const value = await run.observe(observation);
    if (pred(value)) return value;
    if (waited >= maxMs) {
      throw new Error(
        `untilObserved: timed out after ${String(maxMs)}ms waiting for '${observation.name}'`
      );
    }
    await run.apply(passTime, stepMs);
    waited += stepMs;
  }
}
