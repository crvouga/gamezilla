import type { LogEntry, RoomCommandPayload } from '../types';

export type QueuedCommand = {
  id: string;
  ts: number;
  payload: RoomCommandPayload;
};

/**
 * Durable client-side cache: committed tail + outbound command queue.
 */
export interface ClientRoomStorage {
  loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }>;
  saveCommitted(lastSeq: number, entries: LogEntry[]): Promise<void>;
  loadQueued(): Promise<QueuedCommand[]>;
  appendQueued(cmd: QueuedCommand): Promise<void>;
  removeQueued(id: string): Promise<void>;
}
