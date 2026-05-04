import type { LogEntry, RoomError } from '../types';

export type CommandDedupOutcome =
  | { kind: 'committed'; entries: LogEntry[] }
  | { kind: 'rejected'; error: RoomError };

/**
 * Server-authoritative append-only log + command idempotency.
 */
export interface RoomStorage {
  loadEventsAfter(topic: string, afterSeq: number): Promise<LogEntry[]>;
  getLastSeq(topic: string): Promise<number>;
  appendCommittedEntries(topic: string, entries: LogEntry[]): Promise<void>;
  getDedupOutcome(topic: string, commandId: string): Promise<CommandDedupOutcome | null>;
  putDedupOutcome(
    topic: string,
    commandId: string,
    outcome: CommandDedupOutcome
  ): Promise<void>;
}
