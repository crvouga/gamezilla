import type { Clock, Timers } from '@pkgs/clock-shared/types';

import type { AssistantClock } from '@pkgs/assistant-shared/clock';

export function createSystemClock(args: {
  readonly clock: Clock;
  readonly timers: Timers;
}): AssistantClock {
  const { clock, timers } = args;
  return {
    now: () => clock.now(),
    setTimeout: (fn, ms) => {
      const id = timers.setTimeout(fn, ms);
      return { cancel: () => timers.clearTimeout(id) };
    },
  };
}
