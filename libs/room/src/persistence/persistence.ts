import type { Command } from '../room/command';
import type { LogEntry } from './log-entry';

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
