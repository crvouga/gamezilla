import { expect, test } from 'bun:test';
import { openCommit } from '@pkgs/harness-report-shared/publish';
import { pruneReports } from '@pkgs/harness-report-shared/retention';
import { writeUtf8 } from '@pkgs/object-store-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';

// regression: reports-retain-merged-and-superseded-commits
test('keeps only the latest report per live branch, removing merged reports, rerun indexes and orphan uploads', async () => {
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
  const plan = await pruneReports(store, new Map([['counter', head]]));
  expect(plan.retained.map((record) => record.sha)).toEqual([head]);
  const keys = await store.listKeys();
  expect(keys.filter((key) => key.startsWith('index/'))).toHaveLength(1);
  expect(
    keys.filter(
      (key) =>
        key.startsWith(`commits/${old}/`) ||
        key.startsWith(`commits/${merged}/`) ||
        key.startsWith(`commits/${orphan}/`)
    )
  ).toEqual([]);
  expect(await store.head(`commits/${head}/blobs/snapshot.gz`)).toBe(true);
  expect(await store.head('unrelated')).toBe(true);
  expect(
    (await pruneReports(store, new Map([['counter', head]]))).deleteKeys
  ).toEqual([]);
});
