/** Shared OPFS helpers for {@link ./impl-client-fs.ts}. */

import type { ExpoFsOpfsDirHandle } from './expo-fs';

export async function tryGetOpfsFile(
  dir: ExpoFsOpfsDirHandle,
  name: string
): Promise<Awaited<ReturnType<ExpoFsOpfsDirHandle['getFileHandle']>> | null> {
  try {
    return await dir.getFileHandle(name, { create: false });
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') return null;
    throw err;
  }
}

export async function writeOpfs(
  dir: ExpoFsOpfsDirHandle,
  name: string,
  bytes: Uint8Array
): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes);
  } finally {
    await writable.close();
  }
}

export async function removeOpfsIfExists(
  dir: ExpoFsOpfsDirHandle,
  name: string
): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') return;
    throw err;
  }
}

export async function walkOpfsKeys(
  dir: ExpoFsOpfsDirHandle,
  relDir: string,
  metaSuffix: string,
  binSuffix: string
): Promise<string[]> {
  const keys: string[] = [];
  for await (const name of dir.keys()) {
    if (name.endsWith(metaSuffix)) continue;
    if (name.endsWith(binSuffix)) {
      const base = name.slice(0, -binSuffix.length);
      keys.push(relDir.length === 0 ? base : `${relDir}/${base}`);
      continue;
    }
    try {
      const child = await dir.getDirectoryHandle(name, { create: false });
      const childRel = relDir.length === 0 ? name : `${relDir}/${name}`;
      keys.push(
        ...(await walkOpfsKeys(child, childRel, metaSuffix, binSuffix))
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundError') continue;
      // Not a directory — skip.
    }
  }
  return keys;
}

export function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const copy = new Uint8Array(bytes);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(copy);
      controller.close();
    },
  });
}

export async function readAllBytes(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function parseMetaText(text: string): { contentType: string } {
  try {
    const parsed = JSON.parse(text) as { contentType?: unknown };
    const ct =
      typeof parsed.contentType === 'string' && parsed.contentType.length > 0
        ? parsed.contentType
        : 'application/octet-stream';
    return { contentType: ct };
  } catch {
    return { contentType: 'application/octet-stream' };
  }
}
