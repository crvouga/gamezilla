/** Indexed gzip chunks keep snapshot uploads small in count and reads bounded. */
import {
  readBytes,
  readObjectBytes,
  readUtf8,
  writeUtf8,
} from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { eachLimited, inCompletionOrder } from './completion-order';

type Snapshot = { readonly contentType: string; readonly base64: string };
type SnapshotIndex = Readonly<Record<string, string>>;
const CHUNK_BYTES = 1024 * 1024;

function base64(bytes: Uint8Array): string {
  let text = '';
  for (let at = 0; at < bytes.length; at += 0x8000)
    text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

async function gzip(text: string): Promise<Uint8Array> {
  const input = new Blob([text]).stream();
  return readBytes(input.pipeThrough(new CompressionStream('gzip')));
}

export async function publishSnapshotBundle(args: {
  readonly local: ObjectStore;
  readonly remote: ObjectStore;
  readonly localPrefix: string;
  readonly remotePrefix: string;
  readonly files: readonly string[];
}): Promise<void> {
  const index: Record<string, string> = {};
  const chunks: Uint8Array[] = [];
  let entries: Record<string, Snapshot> = {};
  let size = 0;
  const flush = async () => {
    if (size === 0) return;
    chunks.push(await gzip(JSON.stringify(entries)));
    entries = {};
    size = 0;
  };
  for (const file of args.files) {
    const object = await args.local.get(`${args.localPrefix}${file}`);
    if (object === null)
      throw new Error(`Missing report snapshot: ${args.localPrefix}${file}`);
    const snapshot = {
      contentType: object.contentType,
      base64: base64(await readBytes(object.body)),
    };
    const length =
      snapshot.base64.length + file.length + snapshot.contentType.length;
    if (size > 0 && size + length > CHUNK_BYTES) await flush();
    entries[file] = snapshot;
    index[file] = `snapshots-${chunks.length}.json.gz`;
    size += length;
  }
  await flush();
  await eachLimited(
    chunks.map((bytes, part) => ({ bytes, part })),
    4,
    ({ bytes, part }) => {
      return args.remote.put(
        `${args.remotePrefix}snapshots-${part}.json.gz`,
        bytes,
        'application/gzip'
      );
    }
  );
  await writeUtf8(
    args.remote,
    `${args.remotePrefix}snapshots.json`,
    JSON.stringify(index),
    'application/json'
  );
}

export async function readBundledSnapshot(
  store: ObjectStore,
  prefix: string,
  file: string
): Promise<{
  readonly bytes: Uint8Array;
  readonly contentType: string;
} | null> {
  const text = await readUtf8(store, `${prefix}snapshots.json`);
  if (text === null) return null;
  const index = JSON.parse(text) as SnapshotIndex;
  const chunk = index[file];
  if (chunk === undefined) return null;
  const snapshots = await readSnapshotChunk(store, prefix, chunk);
  return snapshotBody(snapshots?.[file]);
}

async function readSnapshotChunk(
  store: ObjectStore,
  prefix: string,
  chunk: string
): Promise<Record<string, Snapshot> | null> {
  if (!/^snapshots-\d+\.json\.gz$/.test(chunk))
    throw new Error('Invalid snapshot chunk');
  const packed = await readObjectBytes(store, `${prefix}${chunk}`);
  if (packed === null) return null;
  const stream = new Blob([packed as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(
    new TextDecoder().decode(await readBytes(stream))
  ) as Record<string, Snapshot>;
}

function snapshotBody(
  snapshot: Snapshot | undefined
): { readonly bytes: Uint8Array; readonly contentType: string } | null {
  if (snapshot === undefined) return null;
  const binary = atob(snapshot.base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return { bytes, contentType: snapshot.contentType };
}

/** A streamed test reads each compressed chunk once even when it contains many frames. */
export async function* readBundledSnapshots(
  store: ObjectStore,
  prefix: string,
  files: ReadonlySet<string>
) {
  const text = await readUtf8(store, `${prefix}snapshots.json`);
  if (text === null) return;
  const index = JSON.parse(text) as SnapshotIndex;
  const chunks = [...new Set([...files].flatMap((file) => index[file] ?? []))];
  const reads = chunks.map(
    (chunk) => () => readSnapshotChunk(store, prefix, chunk)
  );
  for await (const snapshots of inCompletionOrder(reads, 8)) {
    for (const [file, snapshot] of Object.entries(snapshots ?? {})) {
      if (!files.has(file)) continue;
      const body = snapshotBody(snapshot);
      if (body !== null) yield { file, ...body };
    }
  }
}
