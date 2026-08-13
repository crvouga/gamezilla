import { beforeEach, expect, test } from 'bun:test';

import type { ObjectStore } from './interface';

async function readAllBytes(
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

/** Shared abstract suite — run against every ObjectStore adapter. */
export function runObjectStoreContractTests(
  factory: () => ObjectStore | Promise<ObjectStore>
): void {
  let store: ObjectStore;

  beforeEach(async () => {
    store = await Promise.resolve(factory());
  });

  test('get returns null for missing key', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  test('head returns false for missing key', async () => {
    expect(await store.head('missing')).toBe(false);
  });

  test('put then get round-trips bytes and contentType', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    await store.put('k', bytes, 'application/octet-stream');
    const result = await store.get('k');
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.contentType).toBe('application/octet-stream');
    expect(result.size).toBe(5);
    expect(Array.from(await readAllBytes(result.body))).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  test('head returns true after put', async () => {
    await store.put('k', new Uint8Array([1]), 'text/plain');
    expect(await store.head('k')).toBe(true);
  });

  test('put is idempotent and overwrites', async () => {
    await store.put('k', new Uint8Array([1]), 'text/plain');
    await store.put('k', new Uint8Array([9, 9]), 'application/json');
    const result = await store.get('k');
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.contentType).toBe('application/json');
    expect(Array.from(await readAllBytes(result.body))).toEqual([9, 9]);
  });

  test('delete removes the key', async () => {
    await store.put('k', new Uint8Array([1]), 'text/plain');
    await store.delete('k');
    expect(await store.head('k')).toBe(false);
    expect(await store.get('k')).toBeNull();
  });

  test('delete on missing key is a no-op', async () => {
    await expect(store.delete('missing')).resolves.toBeUndefined();
  });

  test('listKeys returns sorted keys and respects prefix', async () => {
    await store.put('b', new Uint8Array([1]), 'text/plain');
    await store.put('a/x', new Uint8Array([2]), 'text/plain');
    await store.put('a/y', new Uint8Array([3]), 'text/plain');
    expect([...(await store.listKeys())]).toEqual(['a/x', 'a/y', 'b']);
    expect([...(await store.listKeys('a/'))]).toEqual(['a/x', 'a/y']);
  });
}
