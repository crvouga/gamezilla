import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { SimulationSnapshot } from '@pkgs/turn-game-shared-ts/simulation';
import type { FixedStepSimulation } from './simulation-engine';

export type SimulationDriverPorts<S> = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly snapshotRate: number;
  readonly publish: (snapshot: SimulationSnapshot<S>) => void;
  /** Aggregation/OTel belongs to the host; callbacks avoid per-tick telemetry allocation. */
  readonly measure: (sample: {
    durationMs: number;
    delayMs: number;
    droppedTicks: number;
  }) => void;
  readonly onError: (error: unknown) => void;
  readonly enqueue?: (work: () => void) => void;
};

/**
 * Whether `now` has reached `at`. Clocks count from the epoch, where one ulp
 * is about 0.2 µs, so an on-time wake can land a rounding error short of an
 * exact boundary; a fixed tolerance below that would skip the boundary.
 */
function reached(now: number, at: number): boolean {
  return now + 1e-9 + Math.abs(at) * Number.EPSILON * 8 >= at;
}

/** Owns one injected timer. Publication cadence is independent of simulation cadence. */
export function driveSimulation<S, I>(
  simulation: FixedStepSimulation<S, I>,
  ports: SimulationDriverPorts<S>
): {
  readonly stop: () => void;
  readonly resetElapsed: () => void;
  readonly suspend: () => void;
  readonly resume: () => void;
} {
  if (
    !Number.isFinite(ports.snapshotRate) ||
    ports.snapshotRate <= 0 ||
    ports.snapshotRate > simulation.options.tickRate
  )
    throw new Error(
      'snapshot rate must be positive and no greater than simulation tick rate'
    );
  const interval = 1000 / simulation.options.tickRate;
  const publishInterval = 1000 / ports.snapshotRate;
  let stopped = false;
  let suspended = false;
  let previous = ports.clock.now();
  let publishAt = previous + publishInterval;
  let timer: unknown;
  const stop = () => {
    stopped = true;
    ports.timers.clearTimeout(timer);
  };
  const execute = () => {
    if (stopped || suspended) return;
    const now = ports.clock.now();
    try {
      const elapsed = Math.max(0, now - previous);
      const result = simulation.advance(elapsed);
      previous = Math.max(previous, now);
      if (reached(now, publishAt)) {
        ports.publish(simulation.snapshot());
        publishAt = now + publishInterval;
      }
      ports.measure({
        durationMs: Math.max(0, ports.clock.now() - now),
        delayMs: Math.max(0, elapsed - interval),
        droppedTicks: result.dropped,
      });
      if (!stopped && !suspended)
        timer = ports.timers.setTimeout(wake, interval);
    } catch (error) {
      stop();
      ports.onError(error);
    }
  };
  const wake = () =>
    ports.enqueue === undefined ? execute() : ports.enqueue(execute);
  timer = ports.timers.setTimeout(wake, interval);
  return {
    stop,
    suspend: () => {
      suspended = true;
      ports.timers.clearTimeout(timer);
    },
    resume: () => {
      if (!suspended || stopped) return;
      suspended = false;
      previous = ports.clock.now();
      publishAt = previous + publishInterval;
      timer = ports.timers.setTimeout(wake, interval);
    },
    resetElapsed: () => {
      previous = ports.clock.now();
    },
  };
}
