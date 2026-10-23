import { expect, test } from 'bun:test';
import type { BundleEntry } from '@crvouga/atlas/reports/bundle';
import {
  BUNDLE_BYTES,
  bundleIndexKey,
  createBundleReader,
  publishBundle,
  readBundleIndex,
} from '@crvouga/atlas/reports/bundle';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

// regression: reports-class-a-snapshot-fanout
test('10,000 snapshot files use two remote writes and a rerun only rewrites the index', async () => {
  const store = new ObjectStoreImplInMemory();
  let writes = 0;
  const put = store.put.bind(store);
  store.put = async (...args) => {
    writes += 1;
    await put(...args);
  };
  const key = bundleIndexKey('a'.repeat(40), 'counter');
  async function* entries(): AsyncGenerator<BundleEntry> {
    for (let n = 0; n < 10_000; n += 1)
      yield {
        key: `frames/${n}.html`,
        bytes: new TextEncoder().encode(`<p>${n}</p>`),
        contentType: 'text/html',
      };
  }
  await publishBundle(store, key, entries());
  expect(writes).toBe(2);
  const read = createBundleReader(store, await readBundleIndex(store, key));
  expect(
    new TextDecoder().decode((await read('frames/9999.html'))?.bytes)
  ).toBe('<p>9999</p>');
  await publishBundle(store, key, entries());
  expect(writes).toBe(3);
  expect(await read('missing')).toBeNull();
});

test('binary files larger than a chunk round-trip with bounded compressed blocks', async () => {
  const store = new ObjectStoreImplInMemory();
  const bytes = new Uint8Array(BUNDLE_BYTES + 101).fill(137);
  const key = bundleIndexKey('b'.repeat(40), 'counter');
  async function* entries(): AsyncGenerator<BundleEntry> {
    yield { key: 'shot.png', bytes, contentType: 'image/png' };
  }
  await publishBundle(store, key, entries());
  const index = await readBundleIndex(store, key);
  expect(index['shot.png']?.parts).toHaveLength(2);
  const result = await createBundleReader(store, index)('shot.png');
  expect(result?.bytes).toEqual(bytes);
  expect(result?.contentType).toBe('image/png');
});

// regression: reports-class-a-snapshot-fanout
test('identical chunks share one upload even when existence reads overlap', async () => {
  const store = new ObjectStoreImplInMemory();
  const head = store.head.bind(store);
  const put = store.put.bind(store);
  let writes = 0;
  store.head = async (...args) => {
    const exists = await head(...args);
    for (let n = 0; n < 500; n += 1) await Promise.resolve();
    return exists;
  };
  store.put = async (...args) => {
    writes += 1;
    await put(...args);
  };
  async function* entries(): AsyncGenerator<BundleEntry> {
    yield {
      key: 'repeated.html',
      bytes: new Uint8Array(BUNDLE_BYTES * 4).fill(65),
      contentType: 'text/html',
    };
  }
  await publishBundle(
    store,
    bundleIndexKey('d'.repeat(40), 'repeated'),
    entries()
  );
  expect(writes).toBe(2);
});

test('arbitrary binary files, including empty files, survive bundling exactly', async () => {
  await assertProperty(
    'bundle bytes and content types round-trip',
    fc.asyncProperty(
      fc.array(fc.uint8Array({ maxLength: 1_000 }), { maxLength: 12 }),
      async (files) => {
        const store = new ObjectStoreImplInMemory();
        const key = bundleIndexKey('e'.repeat(40), 'counter');
        async function* entries(): AsyncGenerator<BundleEntry> {
          for (const [n, bytes] of files.entries())
            yield {
              key: `frames/${n}`,
              bytes,
              contentType: 'application/octet-stream',
            };
        }
        await publishBundle(store, key, entries());
        const read = createBundleReader(
          store,
          await readBundleIndex(store, key)
        );
        for (const [n, bytes] of files.entries())
          expect((await read(`frames/${n}`))?.bytes).toEqual(bytes);
      }
    )
  );
});
