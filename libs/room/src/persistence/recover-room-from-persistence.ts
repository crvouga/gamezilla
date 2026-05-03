import type { Command, RoomApi } from '../room/types';
import type { LogEntry } from './log-entry';
import type { RoomPersistence } from './persistence';

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
