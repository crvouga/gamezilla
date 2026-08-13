import { describe, expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from './impl-in-memory';
import { createS3ObjectStore } from './impl-s3';
import { ObjectStoreWithPrefix } from './impl-with-prefix';
import type { ObjectStore } from './interface';
import { assertRemoteObjectKey } from './namespace-guard';
import { normalizeObjectStoreRootPrefix } from './prefixes';

const TEST_ROOT = normalizeObjectStoreRootPrefix('acme');

const S3_CONFIG = {
  accessKeyId: 'key-id',
  secretAccessKey: 'key-secret',
  bucket: 'bucket',
  endpoint: 'https://s3.us-west-004.backblazeb2.com',
  region: 'us-west-004',
  rootPrefix: TEST_ROOT,
} as const;

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

describe('createS3ObjectStore namespace enforcement', () => {
  test('wraps the S3 store with the injected root prefix', () => {
    const store = createS3ObjectStore(S3_CONFIG);
    expect(store).toBeInstanceOf(ObjectStoreWithPrefix);
  });

  test('logical keys map to root prefix in the inner store', async () => {
    const root = new ObjectStoreImplInMemory();
    const namespaced = new ObjectStoreWithPrefix(root, TEST_ROOT);
    await namespaced.put('k', new Uint8Array([1, 2]), 'text/plain');
    expect(await root.head('acme/k')).toBe(true);
    expect(await root.head('k')).toBe(false);
    const result = await namespaced.get('k');
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(await readAllBytes(result.body)).toEqual(new Uint8Array([1, 2]));
  });

  test('feature withPrefix composes under root prefix', async () => {
    const root = new ObjectStoreImplInMemory();
    let store: ObjectStore = new ObjectStoreWithPrefix(root, TEST_ROOT);
    store = store.withPrefix('tts-audio/');
    await store.put('hash', new Uint8Array([9]), 'audio/mpeg');
    expect(await root.head('acme/tts-audio/hash')).toBe(true);
  });

  test('production wiring only passes namespaced wire keys to transport', async () => {
    const transport = new GuardedTransportMemory(TEST_ROOT);
    let store: ObjectStore = new ObjectStoreWithPrefix(transport, TEST_ROOT);
    store = store.withPrefix('tts-audio/');
    await store.put('hash', new Uint8Array([9]), 'audio/mpeg');
    expect(await transport.head('acme/tts-audio/hash')).toBe(true);
    expect(() =>
      assertRemoteObjectKey('other-project/leak', TEST_ROOT)
    ).toThrow();
  });
});

/** In-memory transport that mirrors S3 wire-key enforcement. */
class GuardedTransportMemory implements ObjectStore {
  private readonly inner = new ObjectStoreImplInMemory();

  constructor(private readonly namespace: string) {}

  get(key: string) {
    assertRemoteObjectKey(key, this.namespace);
    return this.inner.get(key);
  }

  put(key: string, bytes: Uint8Array, contentType: string) {
    assertRemoteObjectKey(key, this.namespace);
    return this.inner.put(key, bytes, contentType);
  }

  head(key: string) {
    assertRemoteObjectKey(key, this.namespace);
    return this.inner.head(key);
  }

  delete(key: string) {
    assertRemoteObjectKey(key, this.namespace);
    return this.inner.delete(key);
  }

  getUri(key: string) {
    assertRemoteObjectKey(key, this.namespace);
    return this.inner.getUri(key);
  }

  listKeys(prefix?: string) {
    if (prefix !== undefined && prefix.length > 0) {
      assertRemoteObjectKey(
        prefix.endsWith('/') ? `${prefix}x` : prefix,
        this.namespace
      );
    }
    return this.inner.listKeys(prefix);
  }

  withPrefix(_prefix: string): ObjectStore {
    throw new Error(
      'S3 transport does not support withPrefix; call withPrefix on createS3ObjectStore() result'
    );
  }
}
