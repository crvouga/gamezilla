import type { LogEntry } from '@pkgs/room-shared/types';
import type { CommandDedupOutcome, RoomStorage } from '@pkgs/room-shared/server-core-storage';
import { eraseRoomIdentity } from '@pkgs/room-shared/room-service';
import type { RoomIdentityErasure } from '@pkgs/room-shared/room-service';

type TopicState = {
  entries: LogEntry[];
  dedup: Map<string, CommandDedupOutcome>;
};

export type RoomStorageTopicSnapshot = {
  readonly lastSeq: number;
  readonly entries: readonly LogEntry[];
  readonly dedupSize: number;
  /** Full dedup map when captured via {@link InMemoryRoomStorage.exportTopic}. */
  readonly dedup?: Readonly<Record<string, CommandDedupOutcome>>;
};

export type RoomStorageTopicReplace = {
  readonly entries: readonly LogEntry[];
  readonly dedup: Readonly<Record<string, CommandDedupOutcome>>;
};

/**
 * Volatile per-process {@link RoomStorage} for tests and the loopback
 * testkit. Not safe across isolates or restarts.
 */
export class InMemoryRoomStorage implements RoomStorage {
  private readonly topics = new Map<string, TopicState>();

  async eraseIdentity(
    topic: string,
    erasure: RoomIdentityErasure,
    invalidation: { commandId: string; entry: LogEntry }
  ): Promise<void> {
    const current: RoomStorageTopicSnapshot = this.exportTopic(topic) ?? {
      lastSeq: 0,
      dedupSize: 0,
      entries: [],
      dedup: {},
    };
    if (current.dedup?.[invalidation.commandId] !== undefined) return;
    const next = eraseRoomIdentity(
      {
        entries: [...current.entries, invalidation.entry],
        dedup: {
          ...current.dedup,
          [invalidation.commandId]: {
            kind: 'committed' as const,
            entries: [invalidation.entry],
          },
        },
      },
      erasure
    );
    this.replaceTopic(topic, next);
  }

  private getOrCreate(topic: string): TopicState {
    let s = this.topics.get(topic);
    if (s === undefined) {
      s = { entries: [], dedup: new Map() };
      this.topics.set(topic, s);
    }
    return s;
  }

  /** Topics that have been touched (events or dedup). */
  listTopics(): readonly string[] {
    return [...this.topics.keys()];
  }

  snapshotTopic(topic: string): RoomStorageTopicSnapshot | null {
    const s = this.topics.get(topic);
    if (s === undefined) return null;
    const lastSeq =
      s.entries.length === 0 ? 0 : s.entries[s.entries.length - 1]!.seq;
    return {
      lastSeq,
      entries: [...s.entries],
      dedupSize: s.dedup.size,
    };
  }

  /** Full topic export including dedup entries (for product-harness snapshots). */
  exportTopic(topic: string): RoomStorageTopicSnapshot | null {
    const s = this.topics.get(topic);
    if (s === undefined) return null;
    const lastSeq =
      s.entries.length === 0 ? 0 : s.entries[s.entries.length - 1]!.seq;
    const dedup: Record<string, CommandDedupOutcome> = {};
    for (const [k, v] of s.dedup) dedup[k] = v;
    return {
      lastSeq,
      entries: [...s.entries],
      dedupSize: s.dedup.size,
      dedup,
    };
  }

  /** Replace topic state atomically (snapshot restore). */
  replaceTopic(topic: string, next: RoomStorageTopicReplace): void {
    const dedup = new Map<string, CommandDedupOutcome>();
    for (const [k, v] of Object.entries(next.dedup)) {
      dedup.set(k, v);
    }
    this.topics.set(topic, {
      entries: [...next.entries],
      dedup,
    });
  }

  clearTopic(topic: string): void {
    this.topics.delete(topic);
  }

  async loadEventsAfter(topic: string, afterSeq: number): Promise<LogEntry[]> {
    const s = this.getOrCreate(topic);
    return s.entries.filter((e) => e.seq > afterSeq);
  }

  async getLastSeq(topic: string): Promise<number> {
    const s = this.topics.get(topic);
    if (s === undefined || s.entries.length === 0) return 0;
    return s.entries[s.entries.length - 1]!.seq;
  }

  async commitCommand(
    topic: string,
    commandId: string,
    newEntries: LogEntry[]
  ): Promise<void> {
    if (newEntries.length === 0) return;
    const s = this.getOrCreate(topic);
    if (s.dedup.has(commandId)) return;
    const last = s.entries[s.entries.length - 1]?.seq ?? 0;
    let expect = last + 1;
    for (const e of newEntries) {
      if (e.seq !== expect) {
        throw new Error(`commitCommand: seq gap expect ${expect} got ${e.seq}`);
      }
      expect++;
    }
    s.entries.push(...newEntries);
    s.dedup.set(commandId, { kind: 'committed', entries: [...newEntries] });
  }

  async getDedupOutcome(
    topic: string,
    commandId: string
  ): Promise<CommandDedupOutcome | null> {
    const s = this.topics.get(topic);
    if (s === undefined) return null;
    return s.dedup.get(commandId) ?? null;
  }

  async putDedupOutcome(
    topic: string,
    commandId: string,
    outcome: Extract<CommandDedupOutcome, { kind: 'rejected' }>
  ): Promise<void> {
    const s = this.getOrCreate(topic);
    if (!s.dedup.has(commandId)) s.dedup.set(commandId, outcome);
  }
}
