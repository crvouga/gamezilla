/** Low-level OPFS helpers shared by {@link ./impl-opfs.ts}. */

import { isNotFoundError } from './opfs';
import type { OpfsDirHandle, OpfsFileHandle } from './opfs';

export async function tryGetOpfsFile(
  dir: OpfsDirHandle,
  name: string
): Promise<OpfsFileHandle | null> {
  try {
    return await dir.getFileHandle(name, { create: false });
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

export async function readOpfsBytes(
  dir: OpfsDirHandle,
  name: string
): Promise<Uint8Array | null> {
  const handle = await tryGetOpfsFile(dir, name);
  if (handle === null) return null;
  const file = await handle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

export async function writeOpfs(
  dir: OpfsDirHandle,
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
  dir: OpfsDirHandle,
  name: string
): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch (err) {
    if (isNotFoundError(err)) return;
    throw err;
  }
}

export type OpfsSuffixes = {
  readonly meta: string;
  readonly bin: string;
};

/** Depth-first walk emitting logical keys (`.bin` files without the suffix). */
export async function walkOpfsKeys(
  dir: OpfsDirHandle,
  relDir: string,
  suffixes: OpfsSuffixes
): Promise<string[]> {
  const keys: string[] = [];
  for await (const name of dir.keys()) {
    if (name.endsWith(suffixes.meta)) continue;
    if (name.endsWith(suffixes.bin)) {
      const base = name.slice(0, -suffixes.bin.length);
      keys.push(relDir.length === 0 ? base : `${relDir}/${base}`);
      continue;
    }
    try {
      const child = await dir.getDirectoryHandle(name, { create: false });
      const childRel = relDir.length === 0 ? name : `${relDir}/${name}`;
      keys.push(...(await walkOpfsKeys(child, childRel, suffixes)));
    } catch (err) {
      if (isNotFoundError(err)) continue;
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

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}
