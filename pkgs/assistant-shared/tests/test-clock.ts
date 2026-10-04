import type { AssistantClock } from '@pkgs/assistant-shared/clock';

/** Minimal clock for engine tests (no delayed callbacks). */
export function createTestClock(now: () => number): AssistantClock {
  return {
    now,
    setTimeout(fn, _ms) {
      fn();
      return { cancel() {} };
    },
  };
}
