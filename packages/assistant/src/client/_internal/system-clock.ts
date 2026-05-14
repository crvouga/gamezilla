import type { AssistantClock } from '../../shared/_internal/clock';

export function createSystemClock(): AssistantClock {
  return { now: () => Date.now() };
}
