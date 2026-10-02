/**
 * Read side of the shared reports store: what a reports API serves. Pure over
 * an injected {@link ObjectStore}, {@link Clock} and {@link Timers}; nothing
 * here imports a runtime or an HTTP framework.
 */

import type { Clock, Timers } from '@pkgs/clock';
import type {
  HtmlReportBlob,
  ReportStep,
  RunReport,
  SnapshotMedia,
} from '@pkgs/harness';
import { readUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore, StoredObject } from '@pkgs/object-store/interface';

import type { BundleEntry } from './bundle';
import { inCompletionOrder } from './completion-order';
import {
  COMMITS_INDEX_PREFIX,
  commitKey,
  frameCssKey,
  isFramePath,
  shaOfIndexKey,
  sourceOfKey,
  sourcesPrefix,
} from './keys';
import type {
  CommitEvent,
  CommitPage,
  CommitRecord,
  SourceRecord,
  TestEvent,
} from './protocol';
import { reportStore } from './publication';
import { readBundledSnapshot, readBundledSnapshots } from './snapshot-bundle';
import { readStoredSource, sourceTestPrefix } from './source-content';
import { sourceReader } from './source-reader';

/** Parallel object reads per stream. */
const READ_WIDTH = 16;
const TEXT_MEDIA: ReadonlySet<string> = new Set(['html', 'json', 'text']);

async function readJson<T>(store: ObjectStore, key: string): Promise<T | null> {
  const text = await readUtf8(store, key);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function readCommit(
  store: ObjectStore,
  sha: string
): Promise<CommitRecord | null> {
  return readJson<CommitRecord>(await reportStore(store, sha), commitKey(sha));
}

export async function readFrameCss(
  store: ObjectStore,
  sha: string
): Promise<StoredObject | null> {
  return (await reportStore(store, sha)).get(frameCssKey(sha));
}

/**
 * Newest commits first, `limit` per page. A commit published twice (a rerun)
 * has two index entries; only the newer one is ever listed, on any page.
 */
export async function listCommits(
  store: ObjectStore,
  options: { readonly limit: number; readonly cursor: string | null }
): Promise<CommitPage> {
  const seen = new Set<string>();
  const newest: { readonly key: string; readonly sha: string }[] = [];
  for (const key of await store.listKeys(COMMITS_INDEX_PREFIX)) {
    const sha = shaOfIndexKey(key);
    if (sha === null || seen.has(sha)) continue;
    seen.add(sha);
    newest.push({ key, sha });
  }
  const after =
    options.cursor === null
      ? newest
      : newest.filter((entry) => entry.key > (options.cursor ?? ''));
  const page = after.slice(0, Math.max(1, options.limit));
  const records = await Promise.all(page.map((e) => readCommit(store, e.sha)));
  return {
    commits: records.filter((r): r is CommitRecord => r !== null),
    cursor: after.length > page.length ? (page.at(-1)?.key ?? null) : null,
  };
}

export type CommitEventsOptions = {
  readonly clock: Clock;
  readonly timers: Timers;
  /** Sources the client already holds (a reconnect): never sent again. */
  readonly have?: ReadonlySet<string>;
  /** How often a running commit is re-listed for new sources. */
  readonly pollMs: number;
  /** A running commit's stream ends after this long; the client reconnects. */
  readonly tailMs: number;
};

function sleep(timers: Timers, ms: number): Promise<void> {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

async function* newSources(
  store: ObjectStore,
  sha: string,
  sent: Set<string>
): AsyncGenerator<SourceRecord> {
  store = await reportStore(store, sha);
  const fresh = (await store.listKeys(sourcesPrefix(sha)))
    .map((key) => sourceOfKey(sha, key))
    .filter((s): s is string => s !== null && !sent.has(s));
  for (const s of fresh) sent.add(s);
  const reads = fresh.map(
    (s) => async () => (await readStoredSource(store, sha, s))?.record ?? null
  );
  for await (const record of inCompletionOrder(reads, READ_WIDTH)) {
    if (record !== null) yield record;
  }
}

/**
 * The commit, then every source in the order its read finishes. While the
 * commit is running, its sources are re-listed every `pollMs` and each new
 * one is sent as it lands, until the commit completes or `tailMs` passes.
 * The state is read before each listing, so a listing after `complete` is
 * the final one.
 */
export async function* commitEvents(
  store: ObjectStore,
  sha: string,
  options: CommitEventsOptions
): AsyncGenerator<CommitEvent> {
  const startedAt = options.clock.now();
  const sent = new Set(options.have ?? []);
  let commit = await readCommit(store, sha);
  yield { type: 'commit', commit };
  for (;;) {
    for await (const source of newSources(store, sha, sent)) {
      yield { type: 'source', source };
    }
    if (commit === null && sent.size === 0) {
      yield { type: 'end', state: 'missing' };
      return;
    }
    if (commit?.state === 'complete') {
      yield { type: 'end', state: 'complete' };
      return;
    }
    if (options.clock.now() - startedAt >= options.tailMs) {
      yield { type: 'end', state: 'running' };
      return;
    }
    await sleep(options.timers, options.pollMs);
    const latest = await readCommit(store, sha);
    if (latest !== null && latest.state !== commit?.state) {
      yield { type: 'commit', commit: latest };
    }
    commit = latest ?? commit;
  }
}

function collectFrameFiles(
  steps: readonly ReportStep[],
  out: Map<string, SnapshotMedia>
): void {
  for (const step of steps) {
    for (const frame of step.frames) {
      for (const blob of frame.snapshots) out.set(blob.file, blob.media);
    }
    collectFrameFiles(step.steps, out);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function frameBlob(obj: BundleEntry, media: SnapshotMedia): HtmlReportBlob {
  return TEXT_MEDIA.has(media)
    ? {
        contentType: obj.contentType,
        text: new TextDecoder().decode(obj.bytes),
      }
    : { contentType: obj.contentType, base64: bytesToBase64(obj.bytes) };
}

/** One test's timeline, without its frame files. */
export async function readTestReport(
  store: ObjectStore,
  args: {
    readonly sha: string;
    readonly source: string;
    readonly testId: string;
  }
): Promise<RunReport | null> {
  store = await reportStore(store, args.sha);
  const prefix = await sourceTestPrefix(store, args);
  if (prefix === null) return null;
  if (prefix.startsWith('content/'))
    return readJson<RunReport>(store, `${prefix}report.json`);
  const read = await sourceReader(store, args);
  const obj = await read(`${prefix}report.json`);
  return obj === null
    ? null
    : (JSON.parse(new TextDecoder().decode(obj.bytes)) as RunReport);
}

export type FrameBody = {
  readonly bytes: Uint8Array;
  readonly contentType: string;
};

/** One frame file's bytes, or null when the test never wrote it. */
export async function readFrameBody(
  store: ObjectStore,
  args: {
    readonly sha: string;
    readonly source: string;
    readonly testId: string;
    readonly file: string;
  }
): Promise<FrameBody | null> {
  store = await reportStore(store, args.sha);
  if (!isFramePath(args.file)) throw new Error('Invalid report frame');
  const prefix = await sourceTestPrefix(store, args);
  if (prefix === null) return null;
  const key = `${prefix}${args.file}`;
  if (prefix.startsWith('content/'))
    return readBundledSnapshot(store, prefix, args.file);
  const read = await sourceReader(store, args);
  const obj = await read(key);
  return obj === null
    ? null
    : { bytes: obj.bytes, contentType: obj.contentType };
}

/** Every source record of a commit, in the order each read finishes. */
export async function listSourceRecords(
  store: ObjectStore,
  sha: string
): Promise<SourceRecord[]> {
  const out: SourceRecord[] = [];
  for await (const source of newSources(store, sha, new Set())) {
    out.push(source);
  }
  return out;
}

/** A test's report, then each of its frame files as its read finishes. */
export async function* testEvents(
  store: ObjectStore,
  args: {
    readonly sha: string;
    readonly source: string;
    readonly testId: string;
  }
): AsyncGenerator<TestEvent> {
  store = await reportStore(store, args.sha);
  const prefix = await sourceTestPrefix(store, args);
  const report = await readTestReport(store, args);
  if (report === null) {
    yield { type: 'end', found: false };
    return;
  }
  yield { type: 'report', report };
  const files = new Map<string, SnapshotMedia>();
  collectFrameFiles(report.steps, files);
  if (prefix?.startsWith('content/')) {
    for await (const frame of readBundledSnapshots(
      store,
      prefix,
      new Set(files.keys())
    )) {
      const blob = TEXT_MEDIA.has(files.get(frame.file) ?? '')
        ? {
            contentType: frame.contentType,
            text: new TextDecoder().decode(frame.bytes),
          }
        : {
            contentType: frame.contentType,
            base64: bytesToBase64(frame.bytes),
          };
      yield { type: 'blob', file: frame.file, blob };
    }
    yield { type: 'end', found: true };
    return;
  }
  const readFile = await sourceReader(store, args);
  const reads = [...files].map(([file, media]) => async () => {
    const obj = await readFile(`${prefix}${file}`);
    return { file, blob: obj === null ? null : frameBlob(obj, media) };
  });
  for await (const read of inCompletionOrder(reads, READ_WIDTH)) {
    if (read.blob !== null) {
      yield { type: 'blob', file: read.file, blob: read.blob };
    }
  }
  yield { type: 'end', found: true };
}
