import type { JsonValue } from '../kernel/json';
import type { Action, BoundObservation, Observation } from '../system/effect';
import type { Run } from './script';

export type UntilObservedOpts<T extends JsonValue = JsonValue> = {
  /** Virtual-time step per poll (default 50). */
  readonly stepMs?: number;
  /** Max virtual time to wait (default 5_000). */
  readonly maxMs?: number;
  /** Predicate; defaults to truthiness of the observation value. */
  readonly pred?: (value: T) => boolean;
};

export type NeverObservedOpts<T extends JsonValue = JsonValue> = {
  /** Virtual-time window the observation must stay falsy for. */
  readonly forMs: number;
  /** Virtual-time step per poll (default 50). */
  readonly stepMs?: number;
  /** Predicate for "holds"; defaults to truthiness. */
  readonly pred?: (value: T) => boolean;
};

/**
 * Poll an observation across `passTime` checkpoints until it holds.
 * One checkpoint per poll — observations are memoised per checkpoint.
 */
export async function untilObserved<S, T extends JsonValue>(
  run: Run<S>,
  observation:
    | Observation<S, [], T>
    | BoundObservation<S, T>
    | Observation<S, unknown[], T>,
  passTime: Action<S, [ms: number]>,
  opts?: UntilObservedOpts<T>
): Promise<T> {
  const stepMs = opts?.stepMs ?? 50;
  const maxMs = opts?.maxMs ?? 5_000;
  const pred = opts?.pred ?? ((v: T) => Boolean(v));
  let waited = 0;
  while (true) {
    const value = await run.observe(observation);
    if (pred(value)) return value;
    if (waited >= maxMs) {
      const name =
        'name' in observation ? observation.name : String(observation);
      throw new Error(
        `untilObserved: timed out after ${String(maxMs)}ms waiting for '${name}'`
      );
    }
    await run.apply(passTime, stepMs);
    waited += stepMs;
  }
}

/**
 * Assert an observation stays falsy across `passTime` checkpoints for `forMs`.
 * Throws if the predicate holds at any poll.
 */
export async function neverObserved<S, T extends JsonValue>(
  run: Run<S>,
  observation:
    | Observation<S, [], T>
    | BoundObservation<S, T>
    | Observation<S, unknown[], T>,
  passTime: Action<S, [ms: number]>,
  opts: NeverObservedOpts<T>
): Promise<void> {
  const stepMs = opts.stepMs ?? 50;
  const forMs = opts.forMs;
  const pred = opts.pred ?? ((v: T) => Boolean(v));
  const name = 'name' in observation ? observation.name : String(observation);
  let waited = 0;
  while (waited < forMs) {
    const value = await run.observe(observation);
    if (pred(value)) {
      throw new Error(
        `neverObserved: '${name}' held after ${String(waited)}ms`
      );
    }
    await run.apply(passTime, stepMs);
    waited += stepMs;
  }
  const last = await run.observe(observation);
  if (pred(last)) {
    throw new Error(
      `neverObserved: '${name}' held at end of ${String(forMs)}ms window`
    );
  }
}
