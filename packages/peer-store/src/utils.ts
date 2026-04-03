import { assert, Assert } from '@gamezilla/shared/assert';
import type { Event, State, StoreModule } from './types';

const crash: Assert = Assert.crash();

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

export function generateId(): string {
  return crypto.randomUUID();
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
