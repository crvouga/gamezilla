import { assert } from '@pkgs/assert-shared/singleton';
import { assertKeywordRecord } from '@pkgs/keyword-shared/keyword';
import type { LogEntry } from '@pkgs/room-shared/types';
import type { CommandDedupOutcome } from '@pkgs/room-shared/server-core-storage';
import { DO_KV_MULTI_KEY_LIMIT, dedupKey, eventKey } from './storage-keys';
import type { RoomDoKeyNs } from './storage-keys';
import type {
  DurableObjectKvStorage,
  DurableObjectKvTransaction,
} from './types';

type KeyNs = RoomDoKeyNs;

type LegacyPersisted = {
  events: LogEntry[];
  dedup: Record<string, CommandDedupOutcome>;
};

export type RoomDoMeta = { lastSeq: number };

function emptyLegacy(): LegacyPersisted {
  return { events: [], dedup: {} };
}

function parseDedup(raw: LegacyPersisted): Record<string, CommandDedupOutcome> {
  if (
    raw.dedup !== undefined &&
    raw.dedup !== null &&
    typeof raw.dedup === 'object'
  ) {
    return raw.dedup as Record<string, CommandDedupOutcome>;
  }
  return {};
}

function assertOptionalPersistedState(raw: LegacyPersisted): void {
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

/** Normalize legacy single-blob KV value into events + dedup. */
export function parseLegacyPersistedBlob(raw: unknown): LegacyPersisted {
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return emptyLegacy();
  }
  const typed = raw as LegacyPersisted;
  const events = Array.isArray(typed.events) ? typed.events : [];
  assertOptionalPersistedState(typed);
  return { events, dedup: parseDedup(typed) };
}

/** Write entries as successive DO multi-puts (≤ 128 keys each). */
export async function putEntriesBatched(
  kv: DurableObjectKvTransaction,
  entries: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(entries);
  for (let i = 0; i < keys.length; i += DO_KV_MULTI_KEY_LIMIT) {
    const chunk: Record<string, unknown> = {};
    for (const k of keys.slice(i, i + DO_KV_MULTI_KEY_LIMIT)) {
      chunk[k] = entries[k];
    }
    await kv.put(chunk);
  }
}

/**
 * Split a monolithic v2 blob into per-event / per-dedup keys + meta, then
 * delete the legacy blob so future writes stay under the 2 MB SQLite row cap.
 */
export async function migrateLegacyBlobToV3(
  kv: DurableObjectKvStorage,
  ns: KeyNs
): Promise<void> {
  const raw = await kv.get(ns.legacyBlob);
  if (raw === undefined) {
    await kv.put(ns.meta, { lastSeq: 0 } satisfies RoomDoMeta);
    return;
  }
  const legacy = parseLegacyPersistedBlob(raw);
  const entries: Record<string, unknown> = {};
  for (const e of legacy.events) {
    entries[eventKey(ns, e.seq)] = e;
  }
  for (const [commandId, outcome] of Object.entries(legacy.dedup)) {
    entries[dedupKey(ns, commandId)] = outcome;
  }
  const lastSeq =
    legacy.events.length > 0 ? legacy.events[legacy.events.length - 1]!.seq : 0;
  entries[ns.meta] = { lastSeq } satisfies RoomDoMeta;
  await kv.transaction(async (tx) => {
    await putEntriesBatched(tx, entries);
    await tx.delete(ns.legacyBlob);
  });
}
