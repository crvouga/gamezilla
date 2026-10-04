import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';

export interface Files {
  store(directory: string): ObjectStore;
  list(input: string): Promise<readonly string[]>;
}

export async function readBytes(
  files: Files,
  path: string
): Promise<Uint8Array> {
  const absolute = resolve(path);
  const value = await files.store(dirname(absolute)).get(basename(absolute));
  if (!value) throw new Error(`File does not exist: ${path}`);
  return new Uint8Array(await new Response(value.body).arrayBuffer());
}

export async function writeBytes(
  files: Files,
  path: string,
  data: Uint8Array,
  contentType = 'application/octet-stream'
): Promise<void> {
  const absolute = resolve(path);
  await files
    .store(dirname(absolute))
    .put(basename(absolute), data, contentType);
}

export async function hashFile(
  files: Files,
  path: string,
  signal?: AbortSignal
): Promise<string> {
  const absolute = resolve(path);
  const value = await files.store(dirname(absolute)).get(basename(absolute));
  if (!value) throw new Error(`File does not exist: ${path}`);
  const hash = createHash('sha256');
  const reader = value.body.getReader();
  try {
    for (;;) {
      signal?.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      hash.update(part.value);
    }
    return hash.digest('hex');
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export function hashBytes(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function readJson<T>(files: Files, path: string): Promise<T> {
  return JSON.parse(
    new TextDecoder().decode(await readBytes(files, path))
  ) as T;
}

export async function writeJson(
  files: Files,
  path: string,
  value: unknown
): Promise<void> {
  await writeBytes(
    files,
    path,
    new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`),
    'application/json'
  );
}
