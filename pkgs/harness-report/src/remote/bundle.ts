import {
  readObjectBytes,
  readUtf8,
  writeUtf8,
} from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';

export const BUNDLE_BYTES = 4 * 1024 * 1024;
type Location = { blob: string; offset: number; size: number };
export type BundleIndex = Record<
  string,
  { contentType: string; parts: Location[] }
>;
export type BundleEntry = {
  key: string;
  bytes: Uint8Array;
  contentType: string;
};

export function bundleIndexKey(sha: string, source: string): string {
  return `commits/${sha}/bundles/${source}.json`;
}

async function transform(
  bytes: Uint8Array,
  decompress: boolean
): Promise<Uint8Array> {
  const buffer = new Uint8Array(bytes).buffer;
  const stream = new Blob([buffer]).stream();
  const output = decompress
    ? stream.pipeThrough(new DecompressionStream('gzip'))
    : stream.pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(output).arrayBuffer());
}

async function flush(
  store: ObjectStore,
  entries: readonly BundleEntry[],
  index: BundleIndex,
  blobPrefix: string
): Promise<void> {
  const bytes = new Uint8Array(
    entries.reduce((size, entry) => size + entry.bytes.length, 0)
  );
  let offset = 0;
  for (const entry of entries) {
    bytes.set(entry.bytes, offset);
    offset += entry.bytes.length;
  }
  const compressed = await transform(bytes, false);
  // Some runtimes put wall time in gzip's MTIME header. Canonicalize it;
  // content identity depends only on the uncompressed bytes.
  compressed.fill(0, 4, 8);
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  const blob = `${blobPrefix}${hash}.gz`;
  // Identical chunks and reruns reuse the same bytes: HEAD is Class B;
  // writing the same content again would still incur a Class A operation.
  if (!(await store.head(blob)))
    await store.put(blob, compressed, 'application/gzip');
  offset = 0;
  for (const entry of entries) {
    (index[entry.key] ??= {
      contentType: entry.contentType,
      parts: [],
    }).parts.push({ blob, offset, size: entry.bytes.length });
    offset += entry.bytes.length;
  }
}

/** Bounded compressed chunks, with one small index published last. */
export async function publishBundle(
  store: ObjectStore,
  key: string,
  entries: AsyncIterable<BundleEntry>
): Promise<void> {
  const index: BundleIndex = {};
  let pending: BundleEntry[] = [];
  let size = 0;
  const blobPrefix = `${key.slice(0, key.indexOf('/bundles/'))}/blobs/`;
  for await (const entry of entries) {
    for (let offset = 0; offset < Math.max(1, entry.bytes.length); ) {
      const bytes = entry.bytes.slice(offset, offset + BUNDLE_BYTES - size);
      pending.push({ ...entry, bytes });
      size += bytes.length;
      offset += Math.max(1, bytes.length);
      if (size === BUNDLE_BYTES) {
        await flush(store, pending, index, blobPrefix);
        pending = [];
        size = 0;
      }
    }
  }
  if (pending.length > 0) await flush(store, pending, index, blobPrefix);
  await writeUtf8(store, key, JSON.stringify(index), 'application/json');
}

/** Cache only immutable blobs; mutable indexes are read for each request. */
export function createBundleReader(
  store: ObjectStore,
  index: BundleIndex
): (key: string) => Promise<BundleEntry | null> {
  const cache = new Map<string, Promise<Uint8Array | null>>();
  return async (key) => {
    const location = index[key];
    if (location === undefined) return null;
    const chunks: Uint8Array[] = [];
    for (const part of location.parts) {
      let pending = cache.get(part.blob);
      if (pending === undefined) {
        if (cache.size >= 4) cache.delete(cache.keys().next().value ?? '');
        pending = readObjectBytes(store, part.blob).then((bytes) =>
          bytes === null ? null : transform(bytes, true)
        );
        cache.set(part.blob, pending);
      }
      const bytes = await pending;
      if (bytes === null) return null;
      chunks.push(bytes.slice(part.offset, part.offset + part.size));
    }
    const bytes = new Uint8Array(
      chunks.reduce((size, chunk) => size + chunk.length, 0)
    );
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return { key, bytes, contentType: location.contentType };
  };
}

export async function readBundleIndex(
  store: ObjectStore,
  key: string
): Promise<BundleIndex> {
  const text = await readUtf8(store, key);
  return text === null ? {} : (JSON.parse(text) as BundleIndex);
}
