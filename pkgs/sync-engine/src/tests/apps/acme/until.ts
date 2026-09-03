import {
  type BoundObservation,
  type JsonValue,
  neverObserved,
  type Observation,
  type Run,
  untilObserved,
} from '@pkgs/dst';
import type { SyncSurface } from '../../../sim/scenario';
import { passTime } from '../../../sim/scenario';

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

type AcmeObs<T extends JsonValue> =
  | Observation<SyncSurface, [], T>
  | BoundObservation<SyncSurface, T>
  | Observation<SyncSurface, unknown[], T>;

/** Thin acme defaults over {@link untilObserved}. Prefer calling dst directly. */
export async function untilAcme<T extends JsonValue>(
  run: Run<SyncSurface>,
  observation: AcmeObs<T>,
  opts?: UntilAcmeOpts
): Promise<T> {
  return untilObserved(run, observation, passTime, {
    stepMs: opts?.stepMs ?? ACME_STEP_MS,
    ...(opts?.maxMs !== undefined ? { maxMs: opts.maxMs } : {}),
    ...(opts?.pred !== undefined ? { pred: opts.pred } : {}),
  });
}

/** Thin acme defaults over {@link neverObserved}. Prefer calling dst directly. */
export async function neverAcme<T extends JsonValue>(
  run: Run<SyncSurface>,
  observation: AcmeObs<T>,
  opts: NeverAcmeOpts
): Promise<void> {
  return neverObserved(run, observation, passTime, {
    forMs: opts.forMs,
    stepMs: opts.stepMs ?? ACME_STEP_MS,
    ...(opts.pred !== undefined ? { pred: opts.pred } : {}),
  });
}
