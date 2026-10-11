import { expect, test } from 'bun:test';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import {
  clearHarnessMockingbirdPostgresSeedProcessCache,
  ensureHarnessMockingbirdPostgresSeedBuffer,
} from '@pkgs/sql-client-root-harness/boot-harness-mockingbird-postgres';

function memoryStore(): ObjectStore {
  const files = new Map<string, Uint8Array>();
  const store: ObjectStore = {
    get(key) {
      const bytes = files.get(key);
      if (bytes === undefined) return Promise.resolve(null);
      return Promise.resolve({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        contentType: 'application/json',
        size: bytes.byteLength,
      });
    },
    put(key, bytes) {
      files.set(key, new Uint8Array(bytes));
      return Promise.resolve();
    },
    head: (key) => Promise.resolve(files.has(key)),
    delete(key) {
      files.delete(key);
      return Promise.resolve();
    },
    deleteMany(keys) {
      for (const key of keys) files.delete(key);
      return Promise.resolve();
    },
    getUri: () => Promise.resolve(null),
    listKeys: () => Promise.resolve([...files.keys()].sort()),
    withPrefix: () => store,
  };
  return store;
}

function queue<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

let tail = Promise.resolve();

// regression: harness-seed-rebuild-stampede
test('workers waiting on a seed rebuild reuse the dump', async () => {
  clearHarnessMockingbirdPostgresSeedProcessCache();
  tail = Promise.resolve();
  let migrates = 0;
  let release: () => void = () => undefined;
  const firstMigrate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const args = {
    store: memoryStore(),
    fingerprintSource: 'schema-v',
    exclusive: queue,
    migrate: () => {
      migrates += 1;
      return migrates === 1 ? firstMigrate : Promise.resolve();
    },
  };
  const first = ensureHarnessMockingbirdPostgresSeedBuffer(args);
  await Bun.sleep(20);
  const second = ensureHarnessMockingbirdPostgresSeedBuffer(args);
  release();
  const [a, b] = await Promise.all([first, second]);
  expect(migrates).toBe(1);
  expect(a.didMigrate).toBe(true);
  expect(b.didMigrate).toBe(false);
  expect(b.seedBytes).toEqual(a.seedBytes);
});
