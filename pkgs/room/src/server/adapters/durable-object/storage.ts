import { assert } from '@pkgs/assert';
import { assertKeywordRecord, asKeyword, type Keyword } from '@pkgs/keyword';
import type { LogEntry, RoomModuleName } from '../../../types';
import type { CommandDedupOutcome, RoomStorage } from '../../core/storage';
import type { DurableObjectKvStorage } from './types';

/**
 * Persisted DO blob key: kebab-namespaced keyword so the storage key follows
 * the same convention as room state / message types. Bump the local segment
 * (e.g. `state-v3`) when the {@link Persisted} shape evolves.
 */
const STATE_KEY: Keyword = asKeyword('room.do/state-v2');

/** Per-module KV blob so one DO can host multiple {@link RoomServer}s safely. */
function stateBlobKey(moduleName: RoomModuleName): Keyword {
  return asKeyword(`room.do/state-v2-${String(moduleName)}`);
}

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
      assert,
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
 * Pass {@link RoomModuleName} to isolate blobs when one DO hosts several modules;
 * omit it to use the legacy single-blob key (`room.do/state-v2`).
 */
export class DurableObjectRoomStorage implements RoomStorage {
  private readonly blobKey: Keyword;

  constructor(
    private readonly kv: DurableObjectKvStorage,
    moduleName?: RoomModuleName
  ) {
    this.blobKey =
      moduleName !== undefined ? stateBlobKey(moduleName) : STATE_KEY;
  }

  private async load(): Promise<Persisted> {
    const raw = await this.kv.get<Persisted>(this.blobKey);
    return parsePersistedBlob(raw);
  }

  private async save(p: Persisted): Promise<void> {
    await this.kv.put(this.blobKey, p);
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
