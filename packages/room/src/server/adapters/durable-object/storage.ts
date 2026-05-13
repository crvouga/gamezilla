import {
  assertKeywordRecord,
  asKeyword,
  type Keyword,
} from '@gamezilla/lib/keyword';
import type { LogEntry } from '../../../types';
import type { CommandDedupOutcome, RoomStorage } from '../../core/storage';
import type { DurableObjectKvStorage } from './types';

/**
 * Persisted DO blob key: kebab-namespaced keyword so the storage key follows
 * the same convention as room state / message types. Bump the local segment
 * (e.g. `state-v3`) when the {@link Persisted} shape evolves.
 */
const STATE_KEY: Keyword = asKeyword('room.do/state-v2');

type Persisted = {
  events: LogEntry[];
  dedup: Record<string, CommandDedupOutcome>;
};

function emptyPersisted(): Persisted {
  return { events: [], dedup: {} };
}

function parseDedup(raw: Persisted): Record<string, CommandDedupOutcome> {
  if (
    raw.dedup !== undefined &&
    raw.dedup !== null &&
    typeof raw.dedup === 'object'
  ) {
    return raw.dedup as Record<string, CommandDedupOutcome>;
  }
  return {};
}

function assertOptionalPersistedState(raw: Persisted): void {
  const maybeState = (raw as Record<string, unknown>)['state'];
  if (
    maybeState !== undefined &&
    maybeState !== null &&
    typeof maybeState === 'object' &&
    !Array.isArray(maybeState)
  ) {
    assertKeywordRecord(
      maybeState as Record<string, unknown>,
      'room.do persisted state'
    );
  }
}

/** Normalize KV blob into {@link Persisted}; invalid shapes yield an empty log. */
function parsePersistedBlob(raw: unknown): Persisted {
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return emptyPersisted();
  }
  const typed = raw as Persisted;
  const events = Array.isArray(typed.events) ? typed.events : [];
  assertOptionalPersistedState(typed);
  return { events, dedup: parseDedup(typed) };
}

/**
 * Single-topic room log persisted in a Durable Object's KV `storage` binding.
 * Suitable for any module that fits in one DO (one topic per instance).
 */
export class DurableObjectRoomStorage implements RoomStorage {
  constructor(private readonly kv: DurableObjectKvStorage) {}

  private async load(): Promise<Persisted> {
    const raw = await this.kv.get<Persisted>(STATE_KEY);
    return parsePersistedBlob(raw);
  }

  private async save(p: Persisted): Promise<void> {
    await this.kv.put(STATE_KEY, p);
  }

  async loadEventsAfter(_topic: string, afterSeq: number): Promise<LogEntry[]> {
    const p = await this.load();
    return p.events.filter((e) => e.seq > afterSeq);
  }

  async getLastSeq(_topic: string): Promise<number> {
    const p = await this.load();
    const last = p.events[p.events.length - 1];
    return last !== undefined ? last.seq : 0;
  }

  async appendCommittedEntries(
    _topic: string,
    newEntries: LogEntry[]
  ): Promise<void> {
    if (newEntries.length === 0) return;
    const p = await this.load();
    const prevLast = p.events[p.events.length - 1]?.seq ?? 0;
    let expect = prevLast + 1;
    for (const e of newEntries) {
      if (e.seq !== expect) {
        throw new Error(
          `DurableObjectRoomStorage.appendCommittedEntries: expected seq ${String(expect)}, got ${String(e.seq)}`
        );
      }
      expect++;
    }
    p.events.push(...newEntries);
    await this.save(p);
  }

  async getDedupOutcome(
    _topic: string,
    commandId: string
  ): Promise<CommandDedupOutcome | null> {
    const p = await this.load();
    return p.dedup[commandId] ?? null;
  }

  async putDedupOutcome(
    _topic: string,
    commandId: string,
    outcome: CommandDedupOutcome
  ): Promise<void> {
    const p = await this.load();
    p.dedup[commandId] = outcome;
    await this.save(p);
  }
}
