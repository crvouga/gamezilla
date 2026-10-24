import type { Message } from '@pkgs/message-shared-ts/message';
import type {
  ClientRoomStorage,
  QueuedCommand,
} from '@pkgs/room-root-shared-ts/core-storage';
import {
  parseRoomLiveCheckpoint,
  type RoomLiveCheckpoint,
  roomLiveCheckpoint,
} from '@pkgs/room-root-shared-ts/live-checkpoint';
import type { LogEntry } from '@pkgs/room-root-shared-ts/types';

/**
 * Volatile per-process {@link ClientRoomStorage} for tests and the loopback
 * testkit. Not safe across reloads or app restarts.
 *
 * Every operation is O(what changed); loads hand out copies so the engine's
 * in-place mutation never aliases the "durable" arrays.
 */
export class InMemoryClientStorage implements ClientRoomStorage {
  private entries: LogEntry[] = [];
  private queue: readonly QueuedCommand[] = [];
  private liveCheckpoint: RoomLiveCheckpoint | null = null;

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    const n = this.entries.length;
    return {
      lastSeq: n === 0 ? 0 : this.entries[n - 1]!.seq,
      entries: this.entries.slice(),
    };
  }

  async appendCommitted(entries: readonly LogEntry[]): Promise<void> {
    for (let i = 0; i < entries.length; i++) this.entries.push(entries[i]!);
  }

  async resetCommitted(): Promise<void> {
    this.entries = [];
    this.liveCheckpoint = null;
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    return this.queue.slice();
  }

  async saveQueued(queue: readonly QueuedCommand[]): Promise<void> {
    this.queue = queue.slice();
  }

  async loadLiveCheckpoint(): Promise<RoomLiveCheckpoint | null> {
    return parseRoomLiveCheckpoint(this.liveCheckpoint);
  }

  async replaceLiveCheckpoint(
    expectedSeq: number,
    payload: Message | null
  ): Promise<boolean> {
    if ((this.entries.at(-1)?.seq ?? 0) !== expectedSeq) return false;
    this.liveCheckpoint =
      payload === null ? null : roomLiveCheckpoint(expectedSeq, payload);
    return true;
  }
}
