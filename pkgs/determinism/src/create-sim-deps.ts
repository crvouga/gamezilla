import type { Clock, Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import {
  type CreateId,
  createSeededCreateId,
  createSeededRng,
  type Random,
  type SeededRng,
} from '@pkgs/uuid';
import { createSimClock } from './clock';
import { createSimScheduler, type SimScheduler } from './scheduler';
import { createSimTimers } from './timers';
import {
  createDisabledTrace,
  createRecordingTrace,
  type SimTrace,
} from './trace';

export type SimDeps = {
  readonly seed: bigint;
  readonly clock: Clock;
  readonly scheduler: SimScheduler;
  readonly timers: Timers;
  readonly rng: SeededRng;
  readonly random: Random;
  readonly createId: CreateId;
  readonly http: HttpClient;
  readonly trace: SimTrace;
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
  readonly trace?: boolean | SimTrace;
};

export function createSimDeps(args: CreateSimDepsArgs): SimDeps {
  const rng = createSeededRng(args.seed);
  const random = rng.fork('io').random;
  const createId = createSeededCreateId(rng.fork('ids').random);
  const simClock = createSimClock(args.startMs ?? 0);
  const trace: SimTrace =
    args.trace === undefined || args.trace === false
      ? createDisabledTrace()
      : typeof args.trace === 'object'
        ? args.trace
        : createRecordingTrace();
  const scheduler = createSimScheduler(simClock, {
    schedRng: rng.fork('sched'),
    ...(trace.enabled ? { trace } : {}),
  });
  const timers = createSimTimers(scheduler);
  return {
    seed: rng.seed,
    clock: simClock,
    scheduler,
    timers,
    rng,
    random,
    createId,
    http: args.http ?? rejectAllHttp,
    trace,
  };
}
