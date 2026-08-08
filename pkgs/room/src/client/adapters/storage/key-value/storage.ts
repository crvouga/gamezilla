import { assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import type { Keyword } from '@pkgs/keyword';
import type { Kv, KvRecord } from '@pkgs/kv/interface';
import { isMessageEnvelope } from '@pkgs/message';

import type { LogEntry } from '../../../../types';
import type { ClientRoomStorage, QueuedCommand } from '../../../core/storage';

const Committed = createAttrNamespace('room', 'client', 'committed');
const Queue = createAttrNamespace('room', 'client', 'queue');

function parseNonNegativeInt(v: unknown): number {
  assert.ok(
    typeof v === 'number' && Number.isFinite(v) && v >= 0,
    'room client committed: last-seq must be a non-negative finite number',
    { v }
  );
  return Math.floor(v);
}

function parseLogEntryArray(v: unknown): LogEntry[] {
  assert.ok(
    Array.isArray(v),
    'room client committed: entries must be an array',
    {
      v,
    }
  );
  const out: LogEntry[] = [];
  for (const item of v) {
    assert.ok(
      item !== null && typeof item === 'object',
      'room client committed: each entry must be an object',
      { item }
    );
    const o = item as Record<string, unknown>;
    assert.ok(
      typeof o['seq'] === 'number' && Number.isFinite(o['seq']),
      'room client committed: entry.seq must be a finite number',
      { o }
    );
    assert.ok(
      isMessageEnvelope(o['event']),
      'room client committed: entry.event must be a message envelope',
      { o }
    );
    out.push({
      seq: Math.floor(o['seq']),
      event: o['event'],
    });
  }
  return out;
}

function parseQueuedCommandArray(v: unknown): QueuedCommand[] {
  assert.ok(Array.isArray(v), 'room client queue: commands must be an array', {
    v,
  });
  const out: QueuedCommand[] = [];
  for (const item of v) {
    assert.ok(
      item !== null && typeof item === 'object',
      'room client queue: each command must be an object',
      { item }
    );
    const o = item as Record<string, unknown>;
    assert.ok(
      typeof o['id'] === 'string' && o['id'].length > 0,
      'room client queue: command.id must be a non-empty string',
      { o }
    );
    assert.ok(
      typeof o['ts'] === 'number' && Number.isFinite(o['ts']),
      'room client queue: command.ts must be a finite number',
      { o }
    );
    assert.ok(
      isMessageEnvelope(o['payload']),
      'room client queue: command.payload must be a message envelope',
      { o }
    );
    out.push({
      id: o['id'],
      ts: o['ts'],
      payload: o['payload'],
    });
  }
  return out;
}

const RoomClientStorageAttr = {
  lastSeq: Committed.integer('last-seq', parseNonNegativeInt),
  entries: Committed.array('entries', parseLogEntryArray),
  commands: Queue.array('commands', parseQueuedCommandArray),
} as const;

const LAST_SEQ_KEY = RoomClientStorageAttr.lastSeq.key;
const ENTRIES_KEY = RoomClientStorageAttr.entries.key;
const COMMANDS_KEY = RoomClientStorageAttr.commands.key;

/** Soft parse — never calls Tiger crash asserts (those exit the process). */
function softLoadCommitted(
  raw: KvRecord
): { lastSeq: number; entries: LogEntry[] } | null {
  const lastSeqRaw = raw[LAST_SEQ_KEY];
  const entriesRaw = raw[ENTRIES_KEY];
  if (
    typeof lastSeqRaw !== 'number' ||
    !Number.isFinite(lastSeqRaw) ||
    lastSeqRaw < 0 ||
    !Array.isArray(entriesRaw)
  ) {
    return null;
  }
  const entries: LogEntry[] = [];
  for (const item of entriesRaw) {
    if (item === null || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    if (typeof o['seq'] !== 'number' || !Number.isFinite(o['seq'])) return null;
    if (!isMessageEnvelope(o['event'])) return null;
    entries.push({ seq: Math.floor(o['seq']), event: o['event'] });
  }
  return { lastSeq: Math.floor(lastSeqRaw), entries };
}

function softLoadQueued(raw: KvRecord): QueuedCommand[] | null {
  const commandsRaw = raw[COMMANDS_KEY];
  if (!Array.isArray(commandsRaw)) return null;
  const out: QueuedCommand[] = [];
  for (const item of commandsRaw) {
    if (item === null || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    if (typeof o['id'] !== 'string' || o['id'].length === 0) return null;
    if (typeof o['ts'] !== 'number' || !Number.isFinite(o['ts'])) return null;
    if (!isMessageEnvelope(o['payload'])) return null;
    out.push({ id: o['id'], ts: o['ts'], payload: o['payload'] });
  }
  return out;
}

/**
 * Async {@link Kv}-backed room cache + outbound queue.
 *
 * Use a non-secure client {@link Kv} (e.g. `KvPlatform` from `@pkgs/kv/kv-platform`):
 * committed-log + queue blobs grow past `expo-secure-store`'s
 * 2048 UTF-8 byte per-value cap as soon as a few entries accumulate. None of
 * this data is sensitive — it's a recovery cache for replay-on-reconnect.
 */
export class KeyValueClientRoomStorage implements ClientRoomStorage {
  constructor(
    private readonly kv: Kv,
    private readonly committedKey: Keyword,
    private readonly queueKey: Keyword
  ) {}

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    const raw = await this.kv.get(this.committedKey);
    if (raw === null) {
      return { lastSeq: 0, entries: [] };
    }
    const parsed = softLoadCommitted(raw);
    if (parsed !== null) return parsed;
    // Local cache is a recovery aid only — wipe unreadable blobs so Room.open
    // can resync from the server instead of failing the whole session.
    await this.kv.zap(this.committedKey);
    return { lastSeq: 0, entries: [] };
  }

  async saveCommitted(lastSeq: number, entries: LogEntry[]): Promise<void> {
    await this.kv.put(this.committedKey, {
      ...RoomClientStorageAttr.lastSeq(lastSeq),
      ...RoomClientStorageAttr.entries(entries),
    });
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    const raw = await this.kv.get(this.queueKey);
    if (raw === null) {
      return [];
    }
    const parsed = softLoadQueued(raw);
    if (parsed !== null) return parsed;
    await this.kv.zap(this.queueKey);
    return [];
  }

  async appendQueued(cmd: QueuedCommand): Promise<void> {
    const cur = await this.loadQueued();
    cur.push(cmd);
    await this.kv.put(this.queueKey, {
      ...RoomClientStorageAttr.commands(cur),
    });
  }

  async removeQueued(id: string): Promise<void> {
    const cur = await this.loadQueued();
    const next = cur.filter((c) => c.id !== id);
    await this.kv.put(this.queueKey, {
      ...RoomClientStorageAttr.commands(next),
    });
  }
}
