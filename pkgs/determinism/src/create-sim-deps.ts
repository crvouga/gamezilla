import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import {
  type CreateId,
  createSeededCreateId,
  createSeededRng,
  type Random,
  type SeededRng,
} from '@pkgs/uuid';
import { createSimClock, type SimClock } from './clock';
import { createSimScheduler, type SimScheduler } from './scheduler';
import { createSimTimers } from './timers';
import { createSimTrace, type SimTrace } from './trace';

export type SimDeps = {
  readonly seed: bigint;
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
  readonly timers: Timers;
  readonly rng: SeededRng;
  readonly random: Random;
  readonly createId: CreateId;
  readonly http: HttpClient;
};

const rejectAllHttp: HttpClient = {
  fetch: async () => {
    throw new Error('SimDeps: HTTP not configured');
  },
};

export type CreateSimDepsArgs = {
  readonly seed: number | bigint | string;
  readonly startMs?: number;
  readonly http?: HttpClient;
  /** Optional; when true, creates an enabled SimTrace wired into the scheduler. */
  readonly trace?: boolean | SimTrace;
};

/**
 * Harness-only simulation deps. Product ClientEnv/ServerEnv receive unpacked
 * clock/timers/createId/random/http — never this bag.
 *
 * Fork tree: root → io (random), ids (createId). Callers fork('net') for
 * SimNetwork. Extra createId draws must not change net draws.
 */
export function createSimDeps(args: CreateSimDepsArgs): SimDeps {
  const rng = createSeededRng(args.seed);
  const random = rng.fork('io').random;
  const createId = createSeededCreateId(rng.fork('ids').random);
  const clock = createSimClock(args.startMs ?? 0);
  const trace =
    args.trace === undefined
      ? undefined
      : typeof args.trace === 'object'
        ? args.trace
        : createSimTrace(args.trace);
  const scheduler = createSimScheduler(clock, trace ? { trace } : undefined);
  const timers = createSimTimers(scheduler);
  return {
    seed: rng.seed,
    clock,
    scheduler,
    timers,
    rng,
    random,
    createId,
    http: args.http ?? rejectAllHttp,
  };
}
