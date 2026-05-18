import type { AssistantClock } from '../../shared/_internal/clock';

export function createSystemClock(): AssistantClock {
  return {
    now: () => Date.now(),
    setTimeout(fn, ms) {
      const id = setTimeout(fn, ms);
      return { cancel: () => clearTimeout(id) };
    },
  };
}
