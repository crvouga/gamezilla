import type { LogEntry } from './log-entry';
import type { Command, RoomApi } from '../room/types';

export type RoomPersistenceEntry =
  | { kind: 'command'; command: Command }
  | { kind: 'committed'; commandId: string; entries: LogEntry[] }
  | { kind: 'rejected'; commandId: string };

/**
 * Pluggable write-ahead persistence journal for durable replicated command
 * intent and outcomes.
 *
 * Implementations persist command intents before processing and outcomes
 * (committed/rejected) after. On recovery, unresolved commands (intent
 * without outcome) can be re-processed.
 *
 * Rows are scoped by `partitionKey`: a stable non-empty string chosen by the
 * caller (e.g. document id, session id, room id) that isolates one journal stream.
 */
export interface RoomPersistence {
  append(partitionKey: string, entry: RoomPersistenceEntry): Promise<void>;
  load(partitionKey: string): Promise<RoomPersistenceEntry[]>;
}

/**
 * Recovers a Room from a persisted journal.
 *
 * Replays committed log rows via `room.rehydrate`, then invokes
 * `onUnresolved` for each command that has no matching committed/rejected
 * entry so the caller can re-validate and vote.
 */
export async function recoverRoomFromPersistence(
  persistence: RoomPersistence,
  partitionKey: string,
  room: RoomApi,
  onUnresolved?: (command: Command) => void
): Promise<void> {
  const entries = await persistence.load(partitionKey);

  const committedLogEntries: LogEntry[] = [];
  const resolvedCommandIds = new Set<string>();

  for (const entry of entries) {
    if (entry.kind === 'committed') {
      resolvedCommandIds.add(entry.commandId);
      committedLogEntries.push(...entry.entries);
    } else if (entry.kind === 'rejected') {
      resolvedCommandIds.add(entry.commandId);
    }
  }

  committedLogEntries.sort((a, b) => a.seq - b.seq);
  room.rehydrate(committedLogEntries);

  if (onUnresolved) {
    for (const entry of entries) {
      if (
        entry.kind === 'command' &&
        !resolvedCommandIds.has(entry.command.id)
      ) {
        onUnresolved(entry.command);
      }
    }
  }
}
