import type { Event } from './message-types'
import { peerNamespace } from './system-messages'

/** System / membership events use this prefix; they never reach `RoomModule.reduce`. */
export const SYSTEM_EVENT_PREFIX = `${peerNamespace.prefix}/`

export function isSystemEvent(event: Event): boolean {
  return peerNamespace.owns(event)
}

export function generateId(): string {
  return globalThis.crypto.randomUUID()
}
