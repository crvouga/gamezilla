import { expect, test } from 'bun:test';
import { openCommit } from '@crvouga/atlas-reports/publish';
import { pruneReports } from '@crvouga/atlas-reports/retention';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';

// regression: reports-retain-merged-and-superseded-commits
test('keeps earlier and merged reports so report layers survive branch changes', async () => {
  const store = new ObjectStoreImplInMemory();
  const old = 'a'.repeat(40),
    head = 'b'.repeat(40),
    merged = 'c'.repeat(40),
    orphan = 'd'.repeat(40);
  for (const [sha, branch, startedAtMs] of [
    [old, 'counter', 1],
    [head, 'counter', 2],
    [head, 'counter', 3],
    [merged, 'merged', 4],
  ] as const) {
    await openCommit(store, {
      sha,
      branch,
      startedAtMs,
      frameCss: '',
      runUrl: null,
    });
    await writeUtf8(
      store,
      `commits/${sha}/blobs/snapshot.gz`,
      'snapshot',
      'text/plain'
    );
  }
  await writeUtf8(
    store,
    `commits/${orphan}/tests/incomplete`,
    'orphan',
    'text/plain'
  );
  await writeUtf8(store, 'unrelated', 'keep', 'text/plain');
  const plan = await pruneReports(store);
  expect(plan.retained.map((record) => record.sha).sort()).toEqual([
    old,
    head,
    merged,
  ]);
  const keys = await store.listKeys();
  expect(keys.filter((key) => key.startsWith('index/'))).toHaveLength(4);
  expect(
    keys.filter(
      (key) =>
        key.startsWith(`commits/${old}/`) ||
        key.startsWith(`commits/${merged}/`) ||
        key.startsWith(`commits/${orphan}/`)
    )
  ).not.toEqual([]);
  expect(await store.head(`commits/${head}/blobs/snapshot.gz`)).toBe(true);
  expect(await store.head('unrelated')).toBe(true);
  expect((await pruneReports(store)).deleteKeys).toEqual([]);
});
