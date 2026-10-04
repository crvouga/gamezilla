import type { ObjectStore } from './interface';

/** Drain a {@link ReadableStream} into a single byte array. */
export async function readBytes(
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

/** Read object bytes as UTF-8 text, or `null` when the key is missing. */
export async function readUtf8(
  store: ObjectStore,
  key: string
): Promise<string | null> {
  const obj = await store.get(key);
  if (obj === null) return null;
  const bytes = await readBytes(obj.body);
  return new TextDecoder().decode(bytes);
}

/** Write UTF-8 text under `key` with the given content type (default text/plain). */
export async function writeUtf8(
  store: ObjectStore,
  key: string,
  text: string,
  contentType = 'text/plain; charset=utf-8'
): Promise<void> {
  await store.put(key, new TextEncoder().encode(text), contentType);
}

/** Read object bytes, or `null` when the key is missing. */
export async function readObjectBytes(
  store: ObjectStore,
  key: string
): Promise<Uint8Array | null> {
  const obj = await store.get(key);
  if (obj === null) return null;
  return readBytes(obj.body);
}
