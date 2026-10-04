import type { LogEntry } from './types';
import type { ClientRoomStorage } from './core-storage';

/** Entries per persisted segment blob; bounds every append to O(segment). */
export const COMMITTED_LOG_SEGMENT_SIZE = 128;

/** Upper bound on orphan-segment probing when the manifest is missing. */
const MAX_ORPHAN_PROBE = 1024;

export type CommittedLogManifest = {
  readonly lastSeq: number;
  readonly segments: number;
};

/**
 * Blob port for {@link createSegmentedCommittedLog}. Adapters map these to
 * their store (`localStorage` keys, `Kv` records, …) and own soft parsing:
 * a corrupt or absent blob reads as `null`.
 */
export interface CommittedLogBlobs {
  readManifest(): Promise<CommittedLogManifest | null>;
  writeManifest(manifest: CommittedLogManifest): Promise<void>;
  removeManifest(): Promise<void>;
  readSegment(index: number): Promise<LogEntry[] | null>;
  writeSegment(index: number, entries: readonly LogEntry[]): Promise<void>;
  removeSegment(index: number): Promise<void>;
}

export type SegmentedCommittedLog = Pick<
  ClientRoomStorage,
  'loadCommitted' | 'appendCommitted' | 'resetCommitted'
>;

type Loaded = { lastSeq: number; entries: LogEntry[] };
type Segments = { entries: LogEntry[]; tail: LogEntry[] };

const EMPTY_MANIFEST: CommittedLogManifest = { lastSeq: 0, segments: 0 };

function isContiguous(entries: readonly LogEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i]!.seq !== entries[i - 1]!.seq + 1) return false;
  }
  return true;
}

async function removeSegments(
  blobs: CommittedLogBlobs,
  count: number
): Promise<void> {
  for (let i = 0; i < count; i++) await blobs.removeSegment(i);
  await blobs.removeManifest();
}

/** Manifest missing: sweep any orphaned segments left by an aborted reset. */
async function removeOrphans(blobs: CommittedLogBlobs): Promise<void> {
  for (let i = 0; i < MAX_ORPHAN_PROBE; i++) {
    if ((await blobs.readSegment(i)) === null) return;
    await blobs.removeSegment(i);
  }
}

async function readAllSegments(
  blobs: CommittedLogBlobs,
  manifest: CommittedLogManifest
): Promise<Segments | null> {
  const reads: Promise<LogEntry[] | null>[] = [];
  for (let i = 0; i < manifest.segments; i++) reads.push(blobs.readSegment(i));
  const segments = await Promise.all(reads);
  const entries: LogEntry[] = [];
  let tail: LogEntry[] = [];
  for (const segment of segments) {
    if (segment === null) return null;
    for (const e of segment) entries.push(e);
    tail = segment;
  }
  return isContiguous(entries) ? { entries, tail } : null;
}

/**
 * Committed-log persistence in fixed-size segments over a blob store.
 *
 * Appending writes only the open tail segment (≤ `segmentSize` entries) plus
 * the tiny manifest, so a long-lived room never re-serializes its history.
 * Any unreadable blob invalidates the whole cache (wiped; the client re-syncs
 * from the server), matching the recovery-cache contract.
 */
export function createSegmentedCommittedLog(
  blobs: CommittedLogBlobs,
  segmentSize: number = COMMITTED_LOG_SEGMENT_SIZE
): SegmentedCommittedLog {
  let manifest: CommittedLogManifest | null = null;
  /** Entries of the open (last) segment; empty when `segments === 0`. */
  let tail: LogEntry[] = [];

  const reset = async (): Promise<void> => {
    const count = manifest?.segments ?? 0;
    manifest = EMPTY_MANIFEST;
    tail = [];
    await removeSegments(blobs, count);
  };

  const load = async (): Promise<Loaded> => {
    const stored = await blobs.readManifest();
    if (stored === null) {
      await removeOrphans(blobs);
      manifest = EMPTY_MANIFEST;
      tail = [];
      return { lastSeq: 0, entries: [] };
    }
    const read = await readAllSegments(blobs, stored);
    manifest = stored;
    if (read === null) {
      await reset();
      return { lastSeq: 0, entries: [] };
    }
    tail = read.tail;
    const n = read.entries.length;
    return {
      lastSeq: n > 0 ? read.entries[n - 1]!.seq : stored.lastSeq,
      entries: read.entries,
    };
  };

  const append = async (entries: readonly LogEntry[]): Promise<void> => {
    if (entries.length === 0) return;
    if (manifest === null) await load();
    let segments = (manifest ?? EMPTY_MANIFEST).segments;
    let i = 0;
    while (i < entries.length) {
      if (segments === 0 || tail.length >= segmentSize) {
        segments += 1;
        tail = [];
      }
      const take = Math.min(segmentSize - tail.length, entries.length - i);
      for (let k = 0; k < take; k++) tail.push(entries[i + k]!);
      i += take;
      await blobs.writeSegment(segments - 1, tail);
    }
    manifest = { lastSeq: entries[entries.length - 1]!.seq, segments };
    await blobs.writeManifest(manifest);
  };

  return {
    loadCommitted: load,
    appendCommitted: append,
    resetCommitted: reset,
  };
}
