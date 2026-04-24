import { Assert } from '@gamezilla/lib/assert'
import type { Command, LogEntry, PeerStoreApi } from './types'

const crash: Assert = Assert.crash()

export type EventLogEntry =
  | { kind: 'command'; command: Command }
  | { kind: 'committed'; commandId: string; entries: LogEntry[] }
  | { kind: 'rejected'; commandId: string }

/**
 * Pluggable write-ahead log for game event durability.
 *
 * Implementations persist command intents before processing and outcomes
 * (committed/rejected) after. On recovery, unresolved commands (intent
 * without outcome) can be re-processed.
 */
export interface EventLog {
  append(gameId: string, entry: EventLogEntry): Promise<void>
  load(gameId: string): Promise<EventLogEntry[]>
}

/**
 * Recovers a PeerStore from a persisted EventLog.
 *
 * Replays committed log rows via `store.rehydrate`, then invokes
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

  const committedLogEntries: LogEntry[] = []
  const resolvedCommandIds = new Set<string>()

  for (const entry of entries) {
    if (entry.kind === 'committed') {
      resolvedCommandIds.add(entry.commandId)
      committedLogEntries.push(...entry.entries)
    } else if (entry.kind === 'rejected') {
      resolvedCommandIds.add(entry.commandId)
    }
  }

  committedLogEntries.sort((a, b) => a.seq - b.seq)
  store.rehydrate(committedLogEntries)

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
  private readonly store = new Map<string, EventLogEntry[]>()

  async append(gameId: string, entry: EventLogEntry): Promise<void> {
    crash.nonEmptyString(gameId, 'gameId must be non-empty')
    const rows = this.store.get(gameId) ?? []
    rows.push(entry)
    this.store.set(gameId, rows)
  }

  async load(gameId: string): Promise<EventLogEntry[]> {
    crash.nonEmptyString(gameId, 'gameId must be non-empty')
    return [...(this.store.get(gameId) ?? [])]
  }
}
