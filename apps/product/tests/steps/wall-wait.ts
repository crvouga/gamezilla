// @io-wall-ok — live health: wall-clock polling for resources warming up.
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';

export const wallWait = {
  now: () => wallClock.now(),
  sleep: (ms: number) =>
    new Promise<void>((resolve) => {
      wallTimers.setTimeout(() => resolve(), ms);
    }),
} as const;
