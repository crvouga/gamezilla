import { Assert } from '@gamezilla/lib/assert'
import type { Command, Event, PeerStoreApi } from './types'

const crash: Assert = Assert.crash()

export type LogEntry =
  | { kind: 'command'; command: Command }
  | { kind: 'committed'; commandId: string; events: Event[] }
  | { kind: 'rejected'; commandId: string }

/**
 * Pluggable write-ahead log for game event durability.
 *
 * Implementations persist command intents before processing and outcomes
 * (committed/rejected) after. On recovery, unresolved commands (intent
 * without outcome) can be re-processed.
 */
export interface EventLog {
  append(gameId: string, entry: LogEntry): Promise<void>
  load(gameId: string): Promise<LogEntry[]>
}

/**
 * Recovers a PeerStore from a persisted EventLog.
 *
 * Replays committed events via `store.rehydrate`, then invokes
 * `onUnresolved` for each command that has no matching committed/rejected
 * entry so the caller can re-validate and vote.
 */
export async function recoverFromEventLog(
  eventLog: EventLog,
  gameId: string,
  store: PeerStoreApi,
  onUnresolved?: (command: Command) => void,
): Promise<void> {
  const entries = await eventLog.load(gameId)

  const committedEvents: Event[] = []
  const resolvedCommandIds = new Set<string>()

  for (const entry of entries) {
    if (entry.kind === 'committed') {
      resolvedCommandIds.add(entry.commandId)
      committedEvents.push(...entry.events)
    } else if (entry.kind === 'rejected') {
      resolvedCommandIds.add(entry.commandId)
    }
  }

  store.rehydrate(committedEvents)

  if (onUnresolved) {
    for (const entry of entries) {
      if (
        entry.kind === 'command' &&
        !resolvedCommandIds.has(entry.command.id)
      ) {
        onUnresolved(entry.command)
      }
    }
  }
}

/**
 * In-memory EventLog backed by a Map. Useful for tests and local dev.
 */
export class InMemoryEventLog implements EventLog {
  private readonly store = new Map<string, LogEntry[]>()

  async append(gameId: string, entry: LogEntry): Promise<void> {
    crash.nonEmptyString(gameId, 'gameId must be non-empty')
    const entries = this.store.get(gameId) ?? []
    entries.push(entry)
    this.store.set(gameId, entries)
  }

  async load(gameId: string): Promise<LogEntry[]> {
    crash.nonEmptyString(gameId, 'gameId must be non-empty')
    return [...(this.store.get(gameId) ?? [])]
  }
}
