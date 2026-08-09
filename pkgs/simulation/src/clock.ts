import type { Clock, Timers } from '@pkgs/clock';
import { wallTimers } from '@pkgs/clock';

/**
 * Monotonic virtual clock for deterministic simulation.
 * Implements {@link Clock}; advance only from the test / system harness.
 */
export type SimulationClock = Clock & {
  /** Advance by ms (must be >= 0). */
  readonly advance: (ms: number) => void;
  /** Jump to absolute time (must be >= now). */
  readonly set: (ms: number) => void;
};

export function createSimulationClock(startMs = 0): SimulationClock {
  let t = startMs;
  return {
    now: () => t,
    advance(ms: number): void {
      if (!(ms >= 0) || !Number.isFinite(ms)) {
        throw new Error(`SimulationClock.advance: bad delta ${ms}`);
      }
      t += ms;
    },
    set(ms: number): void {
      if (!(ms >= t) || !Number.isFinite(ms)) {
        throw new Error(
          `SimulationClock.set: cannot go backwards (${ms} < ${t})`
        );
      }
      t = ms;
    },
  };
}

/**
 * Timers passed into {@link SimulationSystem.start}.
 * v1 uses wall timers so React / ui-testing waits still progress;
 * systems that need virtual timeouts can ignore this and schedule on the clock.
 */
export function createSimulationTimers(): Timers {
  return wallTimers;
}
