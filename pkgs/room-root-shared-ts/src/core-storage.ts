import type { LogEntry, RoomCommandPayload } from './types';

export type QueuedCommand = {
  id: string;
  ts: number;
  payload: RoomCommandPayload;
};

/**
 * Durable client-side cache: committed tail + outbound command queue.
 *
 * This interface is the only contract every client storage adapter
 * (in-memory, `localStorage`, async key-value, future SQLite, etc.) must
 * satisfy. The {@link RoomClient} engine never knows where bytes actually live.
 *
 * Every call is O(what changed), never O(log): the engine appends committed
 * batches and replaces the (bounded) outbound queue snapshot; it never
 * rewrites the whole committed log. Adapters are free to persist as
 * segments, rows, or one growing blob, but should honour that cost model.
 * Calls are serialized by the engine — adapters never see two in flight.
 */
export interface ClientRoomStorage {
  loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }>;
  /** Append a contiguous batch after the stored tail (engine guarantees seq order). */
  appendCommitted(entries: readonly LogEntry[]): Promise<void>;
  /** Drop the committed cache so the next {@link loadCommitted} is empty. */
  resetCommitted(): Promise<void>;
  loadQueued(): Promise<QueuedCommand[]>;
  /** Replace the durable outbound queue with a snapshot of the in-memory queue. */
  saveQueued(queue: readonly QueuedCommand[]): Promise<void>;
}
