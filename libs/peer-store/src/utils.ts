import { Assert } from '@gamezilla/lib/assert';
import type { Event, State, StoreModule } from './types';

const crash: Assert = Assert.crash();

export function generateId(): string {
  return globalThis.crypto.randomUUID();
}

export function replayEvents(module: StoreModule, events: Event[]): State {
  let state = module.initialState();
  for (const event of events) {
    crash.nonEmptyString(event.type, 'replayed event must have non-empty type');
    state = module.reduce(state, event);
    crash.record(state, 'reduce must return a plain object');
  }
  return state;
}
