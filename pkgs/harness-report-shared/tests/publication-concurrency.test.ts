import { expect, test } from 'bun:test';
import {
  BUNDLE_BYTES,
  bundleIndexKey,
  createBundleReader,
  publishBundle,
  readBundleIndex,
} from '@pkgs/harness-report-shared/bundle';
import { publishInventory } from '@pkgs/harness-report-shared/spec-inventory';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';

function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release: () => release() };
}

// regression: reports-single-source-publication-deadline
test('one large source overlaps bounded chunk uploads and preserves byte order', async () => {
  const store = new ObjectStoreImplInMemory();
  const gate = deferred();
  const head = store.head.bind(store);
  const put = store.put.bind(store);
  let heads = 0;
  let writes = 0;
  store.head = async (...args) => {
    heads += 1;
    if (heads === 4) gate.release();
    return head(...args);
  };
  store.put = async (...args) => {
    writes += 1;
    if (writes === 1) await gate.promise;
    await put(...args);
  };
  const bytes = new Uint8Array(BUNDLE_BYTES * 4 + 31);
  for (let n = 0; n < 5; n += 1)
    bytes.fill(n + 1, n * BUNDLE_BYTES, (n + 1) * BUNDLE_BYTES);
  async function* entries() {
    yield { key: 'large.html', bytes, contentType: 'text/html' };
  }
  const key = bundleIndexKey('a'.repeat(40), 'large');
  await publishBundle(store, key, entries());
  const index = await readBundleIndex(store, key);
  expect(index['large.html']?.parts).toHaveLength(5);
  expect((await createBundleReader(store, index)('large.html'))?.bytes).toEqual(
    bytes
  );
}, 1_000);

test('spec bodies publish concurrently and the inventory becomes readable last', async () => {
  const store = new ObjectStoreImplInMemory();
  const gate = deferred();
  const put = store.put.bind(store);
  let started = 0;
  let completed = 0;
  const documents = Array.from({ length: 32 }, (_, n) => ({
    path: `specs/counter/part-${n}.feature`,
    content: `Feature: Part ${n}`,
  }));
  store.put = async (...args) => {
    if (args[0].includes('/specs/')) {
      started += 1;
      if (started === 16) gate.release();
      await gate.promise;
      await put(...args);
      completed += 1;
    } else {
      expect(completed).toBe(documents.length);
      await put(...args);
    }
  };
  await publishInventory(store, { sha: 'b'.repeat(40), documents });
  expect(completed).toBe(32);
}, 1_000);

test('a failed chunk never publishes an index pointing to incomplete content', async () => {
  const store = new ObjectStoreImplInMemory();
  const put = store.put.bind(store);
  store.put = async (...args) => {
    if (args[0].endsWith('.gz')) throw new Error('storage unavailable');
    await put(...args);
  };
  async function* entries() {
    yield {
      key: 'failed.html',
      bytes: new Uint8Array(10),
      contentType: 'text/html',
    };
  }
  const key = bundleIndexKey('c'.repeat(40), 'failed');
  await expect(publishBundle(store, key, entries())).rejects.toThrow(
    'storage unavailable'
  );
  expect(await store.head(key)).toBe(false);
});
