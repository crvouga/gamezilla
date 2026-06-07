import { describe, expect, test } from 'bun:test';
import { createB2ObjectStore } from './impl-b2';
import { ObjectStoreImplInMemory } from './impl-in-memory';
import { ObjectStoreWithPrefix } from './impl-with-prefix';
import type { ObjectStore } from './interface';
import { ObjectStoreNamespace } from './prefixes';

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

describe('createB2ObjectStore namespace enforcement', () => {
  test('wraps the S3 store with the gamezilla root prefix', () => {
    const store = createB2ObjectStore({
      applicationKeyId: 'key-id',
      applicationKey: 'key-secret',
      bucketName: 'bucket',
      s3Endpoint: 'https://s3.us-west-004.backblazeb2.com',
      s3Region: 'us-west-004',
    });
    expect(store).toBeInstanceOf(ObjectStoreWithPrefix);
  });

  test('logical keys map to gamezilla/ in the inner store', async () => {
    const root = new ObjectStoreImplInMemory();
    const namespaced = new ObjectStoreWithPrefix(root, ObjectStoreNamespace.root);
    await namespaced.put('k', new Uint8Array([1, 2]), 'text/plain');
    expect(await root.head('gamezilla/k')).toBe(true);
    expect(await root.head('k')).toBe(false);
    const result = await namespaced.get('k');
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(await readAllBytes(result.body)).toEqual(new Uint8Array([1, 2]));
  });

  test('feature withPrefix composes under gamezilla/', async () => {
    const root = new ObjectStoreImplInMemory();
    let store: ObjectStore = new ObjectStoreWithPrefix(
      root,
      ObjectStoreNamespace.root
    );
    store = store.withPrefix('tts-audio/');
    await store.put('hash', new Uint8Array([9]), 'audio/mpeg');
    expect(await root.head('gamezilla/tts-audio/hash')).toBe(true);
  });
});
