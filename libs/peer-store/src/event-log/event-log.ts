import { Assert } from '@gamezilla/lib/assert'
import type { Command, LogEntry, PeerStoreApi } from '../model/types'

const crash: Assert = Assert.crash()

export type EventLogEntry =
  | { kind: 'command'; command: Command }
  | { kind: 'committed'; commandId: string; entries: LogEntry[] }
  | { kind: 'rejected'; commandId: string }

/**
 * Pluggable write-ahead log for durable replicated command intent and outcomes.
 *
 * Implementations persist command intents before processing and outcomes
 * (committed/rejected) after. On recovery, unresolved commands (intent
 * without outcome) can be re-processed.
 *
 * Rows are scoped by `partitionKey`: a stable non-empty string chosen by the
 * caller (e.g. document id, session id, room id) that isolates one log stream.
 */
export interface EventLog {
  append(partitionKey: string, entry: EventLogEntry): Promise<void>
  load(partitionKey: string): Promise<EventLogEntry[]>
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
  partitionKey: string,
  store: PeerStoreApi,
  onUnresolved?: (command: Command) => void,
): Promise<void> {
  const entries = await eventLog.load(partitionKey)

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
