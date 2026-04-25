import { Assert } from '@gamezilla/lib/assert'
import type { Event, LogEntry, State, StoreModule } from './types'
import { peerNamespace } from './system-messages'

const crash: Assert = Assert.crash()

/** System / membership events use this prefix; they never reach `StoreModule.reduce`. */
export const SYSTEM_EVENT_PREFIX = `${peerNamespace.prefix}/`

export function isSystemEvent(event: Event): boolean {
  return peerNamespace.owns(event)
}

export function generateId(): string {
  return globalThis.crypto.randomUUID()
}

/**
 * Replays only domain events (skips `_peer/...`) in order.
 */
export function replayDomainEntries(module: StoreModule, entries: LogEntry[]): State {
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
