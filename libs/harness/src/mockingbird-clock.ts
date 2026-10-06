import type { Clock } from '@pkgs/clock-shared/types';

/** Service time is owned by the harness scheduler, including its fault and replay controls. */
export function mockingbirdClock(clock: Clock) {
  return {
    now: () => clock.now(),
    set: () => undefined,
    advance: () => undefined,
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => undefined,
    state: () => ({ now: clock.now(), frozen: false, offsetMs: 0 }),
  };
}
