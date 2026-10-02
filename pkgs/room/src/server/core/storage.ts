import type { LogEntry, RoomError } from '../../types';

export type CommandDedupOutcome =
  | { kind: 'committed'; entries: LogEntry[] }
  | { kind: 'rejected'; error: RoomError };

/**
 * Server-authoritative append-only log + command idempotency.
 *
 * This interface is the only contract every adapter (Durable Object,
 * in-memory, future Postgres, etc.) must satisfy. The {@link RoomServer}
 * engine never knows where bytes actually live.
 */
export interface RoomStorage {
  loadEventsAfter(topic: string, afterSeq: number): Promise<LogEntry[]>;
  getLastSeq(topic: string): Promise<number>;
  /** The log and its retry verdict must persist atomically, including multi-event commands. */
  commitCommand(
    topic: string,
    commandId: string,
    entries: LogEntry[]
  ): Promise<void>;
  getDedupOutcome(
    topic: string,
    commandId: string
  ): Promise<CommandDedupOutcome | null>;
  putDedupOutcome(
    topic: string,
    commandId: string,
    outcome: Extract<CommandDedupOutcome, { kind: 'rejected' }>
  ): Promise<void>;
}
