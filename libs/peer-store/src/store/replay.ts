import { Assert } from '@gamezilla/lib/assert'
import type { LogEntry } from '../persistence/log-entry'
import type { Event } from '../events/message-types'
import { isSystemEvent } from '../events/utils'
import type { State, StoreModule } from './types'

const crash: Assert = Assert.crash()

/**
 * Replays only domain events (skips `_peer/...`) in order.
 */
export function replayDomainEntries(
  module: StoreModule,
  entries: LogEntry[],
): State {
  let state = module.initialState()
  for (const { event } of entries) {
    if (isSystemEvent(event)) continue
    crash.nonEmptyString(event.type, 'replayed event must have non-empty type')
    state = module.reduce(state, event)
    crash.record(state, 'reduce must return a plain object')
  }
  return state
}

/** Replays a flat list of domain events (no seq). Skips system events if present. */
export function replayEvents(module: StoreModule, events: Event[]): State {
  let state = module.initialState()
  for (const event of events) {
    if (isSystemEvent(event)) continue
    crash.nonEmptyString(event.type, 'replayed event must have non-empty type')
    state = module.reduce(state, event)
    crash.record(state, 'reduce must return a plain object')
  }
  return state
}
