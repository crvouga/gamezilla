import { Assert } from '@pkgs/assert-root-shared-ts/assert';
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
import type {
  CommittedLogBlobs,
  CommittedLogManifest,
  SegmentedCommittedLog,
} from '@pkgs/room-root-shared-ts/segmented-committed-log';
import { createSegmentedCommittedLog } from '@pkgs/room-root-shared-ts/segmented-committed-log';
import type { LogEntry } from '@pkgs/room-root-shared-ts/types';

const crash: Assert = Assert.crash();

type WebStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function readJson(raw: string | null): unknown {
  if (raw === null || raw.length === 0) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function parseManifest(raw: unknown): CommittedLogManifest | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const lastSeq = o['lastSeq'];
  const segments = o['segments'];
  if (!isNonNegativeInt(lastSeq) || !isNonNegativeInt(segments)) return null;
  return { lastSeq, segments };
}

function parseEntries(raw: unknown): LogEntry[] | null {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (item === null || typeof item !== 'object') return null;
    if (typeof (item as { seq?: unknown }).seq !== 'number') return null;
  }
  return raw as LogEntry[];
}

/** Blob port over synchronous `localStorage` (wrapped async for the codec). */
function webCommittedLogBlobs(
  storage: WebStorage,
  prefix: string
): CommittedLogBlobs {
  const manifestKey = `${prefix}:committed`;
  const segmentKey = (i: number): string => `${prefix}:committed.${String(i)}`;
  return {
    readManifest: async () => {
      const parsed = parseManifest(readJson(storage.getItem(manifestKey)));
      if (parsed === null) storage.removeItem(manifestKey);
      return parsed;
    },
    writeManifest: async (manifest) => {
      storage.setItem(manifestKey, JSON.stringify(manifest));
    },
    removeManifest: async () => {
      storage.removeItem(manifestKey);
    },
    readSegment: async (i) =>
      parseEntries(readJson(storage.getItem(segmentKey(i)))),
    writeSegment: async (i, entries) => {
      storage.setItem(segmentKey(i), JSON.stringify(entries));
    },
    removeSegment: async (i) => {
      storage.removeItem(segmentKey(i));
    },
  };
}

/**
 * Synchronous `localStorage`-backed room cache (topic-scoped keys). Web only.
 *
 * The committed log is persisted in fixed-size segments, so an append costs
 * one small segment write instead of re-serializing the whole history.
 *
 * Use {@link KeyValueClientRoomStorage} instead when the same code must run
 * in a non-DOM environment — `localStorage` is not available there.
 */
export class WebClientStorage implements ClientRoomStorage {
  private readonly log: SegmentedCommittedLog;
  private readonly queueKey: string;

  constructor(
    private readonly prefix: string,
    private readonly storage: WebStorage
  ) {
    crash.nonEmptyString(prefix, 'WebClientStorage prefix must be non-empty');
    this.log = createSegmentedCommittedLog(
      webCommittedLogBlobs(storage, prefix)
    );
    this.queueKey = `${prefix}:queue`;
  }

  loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    return this.log.loadCommitted();
  }

  appendCommitted(entries: readonly LogEntry[]): Promise<void> {
    return this.log.appendCommitted(entries);
  }

  async resetCommitted(): Promise<void> {
    await this.log.resetCommitted();
    this.storage.removeItem(`${this.prefix}:live-checkpoint`);
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    const parsed = readJson(this.storage.getItem(this.queueKey));
    return Array.isArray(parsed) ? (parsed as QueuedCommand[]) : [];
  }

  async saveQueued(queue: readonly QueuedCommand[]): Promise<void> {
    this.storage.setItem(this.queueKey, JSON.stringify(queue));
  }

  async loadLiveCheckpoint(): Promise<RoomLiveCheckpoint | null> {
    return parseRoomLiveCheckpoint(
      readJson(this.storage.getItem(`${this.prefix}:live-checkpoint`))
    );
  }

  async replaceLiveCheckpoint(
    expectedSeq: number,
    payload: Message | null
  ): Promise<boolean> {
    const checkpoint =
      payload === null ? null : roomLiveCheckpoint(expectedSeq, payload);
    const manifest = parseManifest(
      readJson(this.storage.getItem(`${this.prefix}:committed`))
    );
    if ((manifest?.lastSeq ?? 0) !== expectedSeq) return false;
    const key = `${this.prefix}:live-checkpoint`;
    if (checkpoint === null) this.storage.removeItem(key);
    else this.storage.setItem(key, JSON.stringify(checkpoint));
    return true;
  }
}
