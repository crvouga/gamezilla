import type { Event } from '../events/message-types'

/**
 * One committed row in the replicated log (global `seq`, monotonic per space).
 * May be a system event (`_peer/...`) or a domain event.
 */
export type LogEntry = {
  seq: number
  event: Event
}
