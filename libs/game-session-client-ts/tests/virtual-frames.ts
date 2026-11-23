import type { FrameScheduler } from '@libs/game-session-client-ts/simulation-presentation-session';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';

/**
 * A 60 Hz display on virtual time: each requested frame runs at the next
 * refresh. Nothing is scheduled while no frame is requested, so a disposed
 * presentation leaves no timer behind.
 */
export function virtualFrames(time: {
  readonly clock: Clock;
  readonly timers: Timers;
}): FrameScheduler {
  const interval = 1000 / 60;
  const callbacks = new Map<number, (at: number) => void>();
  let next = 0;
  let timer: unknown = null;
  const refresh = () => {
    timer = null;
    const due = [...callbacks.values()];
    callbacks.clear();
    const at = time.clock.now();
    for (const callback of due) callback(at);
  };
  return {
    requestAnimationFrame: (callback) => {
      callbacks.set(++next, callback);
      if (timer === null) {
        const now = time.clock.now();
        const at = (Math.floor(now / interval) + 1) * interval;
        timer = time.timers.setTimeout(refresh, at - now);
      }
      return next;
    },
    cancelAnimationFrame: (handle) => {
      callbacks.delete(handle);
      if (callbacks.size === 0 && timer !== null) {
        time.timers.clearTimeout(timer);
        timer = null;
      }
    },
  };
}
