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
  let wakeAt = previous + interval;
  let timer: unknown;
  /**
   * Wakes keep the tick grid: a timer firing a little late or rounded to a
   * whole millisecond never drifts the next one, so publications stay evenly
   * spaced in ticks. Falling a whole tick behind restarts the grid.
   */
  const schedule = (now: number) => {
    wakeAt += interval;
    if (wakeAt <= now) wakeAt = now + interval;
    timer = ports.timers.setTimeout(wake, wakeAt - now);
  };
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
      // Publications keep their own grid: each goes out on the wake nearest
      // its moment, so a wake landing a hair early never stretches one gap
      // to an extra tick. Falling a whole publication behind restarts it.
      if (reached(now + interval / 2, publishAt)) {
        ports.publish(simulation.snapshot());
        publishAt += publishInterval;
        if (reached(now + interval / 2, publishAt))
          publishAt = now + publishInterval;
      }
      ports.measure({
        durationMs: Math.max(0, ports.clock.now() - now),
        delayMs: Math.max(0, elapsed - interval),
        droppedTicks: result.dropped,
      });
      if (!stopped && !suspended) schedule(ports.clock.now());
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
      wakeAt = previous + interval;
      timer = ports.timers.setTimeout(wake, interval);
    },
    resetElapsed: () => {
      previous = ports.clock.now();
    },
  };
}
