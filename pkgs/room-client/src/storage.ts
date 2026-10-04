import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import type { Keyword } from '@pkgs/keyword-shared/keyword';
import type { Kv, KvRecord } from '@pkgs/kv-shared/interface';
import { isMessageEnvelope } from '@pkgs/message-shared/message';

import type { LogEntry } from '@pkgs/room-shared/types';
import type { ClientRoomStorage, QueuedCommand } from '@pkgs/room-shared/core-storage';
import type { CommittedLogBlobs, CommittedLogManifest, SegmentedCommittedLog } from '@pkgs/room-shared/segmented-committed-log';
import { createSegmentedCommittedLog } from '@pkgs/room-shared/segmented-committed-log';
import { committedSegmentKeyword } from './keys';

const Committed = createAttrNamespace('room', 'client', 'committed');
const Queue = createAttrNamespace('room', 'client', 'queue');

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

const RoomStorageAttr = {
  lastSeq: Committed.integer('last-seq', (v): number =>
    isNonNegativeInt(v) ? v : 0
  ),
  segments: Committed.integer('segments', (v): number =>
    isNonNegativeInt(v) ? v : 0
  ),
  entries: Committed.array('entries', (v): LogEntry[] =>
    Array.isArray(v) ? (v as LogEntry[]) : []
  ),
  commands: Queue.array('commands', (v): QueuedCommand[] =>
    Array.isArray(v) ? (v as QueuedCommand[]) : []
  ),
} as const;

const LAST_SEQ_KEY = RoomStorageAttr.lastSeq.key;
const SEGMENTS_KEY = RoomStorageAttr.segments.key;
const ENTRIES_KEY = RoomStorageAttr.entries.key;
const COMMANDS_KEY = RoomStorageAttr.commands.key;

/** Soft parse — never calls Tiger crash asserts (those exit the process). */
function softManifest(raw: KvRecord): CommittedLogManifest | null {
  const lastSeq = raw[LAST_SEQ_KEY];
  const segments = raw[SEGMENTS_KEY];
  if (!isNonNegativeInt(lastSeq) || !isNonNegativeInt(segments)) return null;
  return { lastSeq, segments };
}

function softEntries(raw: KvRecord): LogEntry[] | null {
  const entriesRaw = raw[ENTRIES_KEY];
  if (!Array.isArray(entriesRaw)) return null;
  const entries: LogEntry[] = [];
  for (const item of entriesRaw) {
    if (item === null || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    if (!isFiniteNumber(o['seq'])) return null;
    if (!isMessageEnvelope(o['event'])) return null;
    entries.push(o as unknown as LogEntry);
  }
  return entries;
}

function softQueued(raw: KvRecord): QueuedCommand[] | null {
  const commandsRaw = raw[COMMANDS_KEY];
  if (!Array.isArray(commandsRaw)) return null;
  const out: QueuedCommand[] = [];
  for (const item of commandsRaw) {
    if (item === null || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    if (typeof o['id'] !== 'string' || o['id'].length === 0) return null;
    if (!isFiniteNumber(o['ts'])) return null;
    if (!isMessageEnvelope(o['payload'])) return null;
    out.push({ id: o['id'], ts: o['ts'], payload: o['payload'] });
  }
  return out;
}

function kvCommittedLogBlobs(kv: Kv, committedKey: Keyword): CommittedLogBlobs {
  const segmentKey = (i: number): Keyword =>
    committedSegmentKeyword(committedKey, i);
  return {
    readManifest: async () => {
      const raw = await kv.get(committedKey);
      if (raw === null) return null;
      const parsed = softManifest(raw);
      if (parsed === null) await kv.zap(committedKey);
      return parsed;
    },
    writeManifest: (manifest) =>
      kv.put(committedKey, {
        ...RoomStorageAttr.lastSeq(manifest.lastSeq),
        ...RoomStorageAttr.segments(manifest.segments),
      }),
    removeManifest: () => kv.zap(committedKey),
    readSegment: async (i) => {
      const raw = await kv.get(segmentKey(i));
      return raw === null ? null : softEntries(raw);
    },
    writeSegment: (i, entries) =>
      kv.put(segmentKey(i), { ...RoomStorageAttr.entries(entries) }),
    removeSegment: (i) => kv.zap(segmentKey(i)),
  };
}

/**
 * Async {@link Kv}-backed room cache + outbound queue.
 *
 * The committed log lives in fixed-size segment records hanging off
 * `committedKey` (the manifest), so appends never rewrite history. Use a
 * non-secure client {@link Kv} (e.g. the web `@pkgs/kv-web-shared` backend): even a
 * single segment outgrows the secure-store's 2048 UTF-8 byte per-value cap.
 * None of this data is sensitive — it's a recovery cache for
 * replay-on-reconnect.
 */
export class KeyValueClientRoomStorage implements ClientRoomStorage {
  private readonly log: SegmentedCommittedLog;

  constructor(
    private readonly kv: Kv,
    committedKey: Keyword,
    private readonly queueKey: Keyword
  ) {
    this.log = createSegmentedCommittedLog(
      kvCommittedLogBlobs(kv, committedKey)
    );
  }

  loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    return this.log.loadCommitted();
  }

  appendCommitted(entries: readonly LogEntry[]): Promise<void> {
    return this.log.appendCommitted(entries);
  }

  resetCommitted(): Promise<void> {
    return this.log.resetCommitted();
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    const raw = await this.kv.get(this.queueKey);
    if (raw === null) return [];
    const parsed = softQueued(raw);
    if (parsed !== null) return parsed;
    // Local cache is a recovery aid only — wipe unreadable blobs so RoomClient.open
    // can resync from the server instead of failing the whole session.
    await this.kv.zap(this.queueKey);
    return [];
  }

  async saveQueued(queue: readonly QueuedCommand[]): Promise<void> {
    await this.kv.put(this.queueKey, {
      ...RoomStorageAttr.commands(queue),
    });
  }
}
