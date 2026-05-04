import type { LogEntry } from '../../types';
import type { CommandDedupOutcome, RoomStorage } from '../storage';

type TopicState = {
  entries: LogEntry[];
  dedup: Map<string, CommandDedupOutcome>;
};

export class InMemoryRoomStorage implements RoomStorage {
  private readonly topics = new Map<string, TopicState>();

  private getOrCreate(topic: string): TopicState {
    let s = this.topics.get(topic);
    if (s === undefined) {
      s = { entries: [], dedup: new Map() };
      this.topics.set(topic, s);
    }
    return s;
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

  async appendCommittedEntries(
    topic: string,
    newEntries: LogEntry[]
  ): Promise<void> {
    if (newEntries.length === 0) return;
    const s = this.getOrCreate(topic);
    const last = s.entries[s.entries.length - 1]?.seq ?? 0;
    let expect = last + 1;
    for (const e of newEntries) {
      if (e.seq !== expect) {
        throw new Error(
          `appendCommittedEntries: seq gap expect ${expect} got ${e.seq}`
        );
      }
      expect++;
    }
    s.entries.push(...newEntries);
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
    outcome: CommandDedupOutcome
  ): Promise<void> {
    const s = this.getOrCreate(topic);
    s.dedup.set(commandId, outcome);
  }
}
