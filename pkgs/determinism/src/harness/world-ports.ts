import type { Clock, Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import {
  type CreateId,
  createSeededCreateId,
  createSeededRng,
  type Random,
  type SeededRng,
} from '@pkgs/uuid';
import { createVirtualClock } from '../kernel/clock';
import { createScheduler, type Scheduler } from '../kernel/scheduler';
import { createTimers } from '../kernel/timers';
import {
  createTraceRecorder,
  NOOP_TRACE_RECORDER,
  type TraceRecorder,
} from '../kernel/trace';

/**
 * The SUT boundary: every port a Node may use, all derived from one Seed and
 * the World's Scheduler. Harness-only — product envs receive these unpacked.
 */
export type WorldPorts = {
  readonly seed: bigint;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly timers: Timers;
  readonly rng: SeededRng;
  readonly random: Random;
  readonly createId: CreateId;
  readonly http: HttpClient;
  readonly trace: TraceRecorder;
};

const rejectAllHttp: HttpClient = {
  fetch: async () => {
    throw new Error('WorldPorts: HTTP not configured');
  },
};

export type CreateWorldPortsOptions = {
  readonly seed: number | bigint | string;
  readonly startTime?: number;
  readonly http?: HttpClient;
  readonly trace?: boolean | TraceRecorder;
};

export function createWorldPorts(opts: CreateWorldPortsOptions): WorldPorts {
  const rng = createSeededRng(opts.seed);
  const random = rng.fork('io').random;
  const createId = createSeededCreateId(rng.fork('ids').random);
  const clock = createVirtualClock(opts.startTime ?? 0);
  const trace: TraceRecorder =
    opts.trace === undefined || opts.trace === false
      ? NOOP_TRACE_RECORDER
      : typeof opts.trace === 'object'
        ? opts.trace
        : createTraceRecorder();
  const scheduler = createScheduler(clock, {
    // TODO(dst-audit): fork labels become structural ChoiceIds in Phase 3.2.
    choiceRng: rng.fork('sched'),
    ...(trace.enabled ? { trace } : {}),
  });
  const timers = createTimers(scheduler);
  return {
    seed: rng.seed,
    clock,
    scheduler,
    timers,
    rng,
    random,
    createId,
    http: opts.http ?? rejectAllHttp,
    trace,
  };
}
