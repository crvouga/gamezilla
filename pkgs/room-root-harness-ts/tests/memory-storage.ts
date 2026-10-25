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

/** Test double with op counters so tests can assert persistence cost/order. */
export class CountingClientStorage implements ClientRoomStorage {
  entries: LogEntry[] = [];
  queue: readonly QueuedCommand[] = [];
  appends = 0;
  resets = 0;
  queueSaves = 0;
  appendedEntries = 0;
  private liveCheckpoint: RoomLiveCheckpoint | null = null;

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    const n = this.entries.length;
    return {
      lastSeq: n === 0 ? 0 : this.entries[n - 1]!.seq,
      entries: this.entries.slice(),
    };
  }

  async appendCommitted(entries: readonly LogEntry[]): Promise<void> {
    this.appends += 1;
    this.appendedEntries += entries.length;
    for (const e of entries) this.entries.push(e);
  }

  async resetCommitted(): Promise<void> {
    this.resets += 1;
    this.entries = [];
    this.liveCheckpoint = null;
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    return this.queue.slice();
  }

  async saveQueued(queue: readonly QueuedCommand[]): Promise<void> {
    this.queueSaves += 1;
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
