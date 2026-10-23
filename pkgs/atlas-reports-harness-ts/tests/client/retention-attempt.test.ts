import { expect, test } from 'bun:test';
import { publicationStore } from '@crvouga/atlas/reports/publication';
import {
  closeCommit,
  openCommit,
  publishSource,
  SPEC_RUN_ID,
} from '@crvouga/atlas/reports/publish';
import {
  readCommit,
  readTestReport,
  testEvents,
} from '@crvouga/atlas/reports/read';
import { pruneReports } from '@crvouga/atlas/reports/retention';
import {
  reuseSource,
  sourceContentPrefix,
} from '@crvouga/atlas/reports/source-content';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { exampleApp, put } from './example-app';

const OLD = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const source = 'libs-example--part-0';
const identity = { taskHash: '0123456789abcdef', generation: 12 };
const bucket = { packageDir: 'libs/example', bucket: 'part-0', identity };

// regression: reports-cleanup-attempt-shared-content
test('cleanup retains earlier attempts and shared content for report layers', async () => {
  const store = new ObjectStoreImplInMemory();
  const local = new ObjectStoreImplInMemory();
  {
    await using session = await exampleApp().run({
      seed: 3,
      report: {
        store: local,
        runId: SPEC_RUN_ID,
        testId: 'put',
        title: 'puts a value',
        now: () => 5000,
      },
    });
    await session.apply(put, 'x', 'retained snapshot');
  }
  for (const [sha, publicationId, startedAtMs] of [
    [OLD, 'run:1', 1],
    [HEAD, 'run:2', 2],
    [HEAD, 'run:3', 3],
  ] as const) {
    await openCommit(store, {
      sha,
      branch: 'counter',
      publicationId,
      startedAtMs,
      frameCss: '',
      runUrl: null,
    });
    const target = publicationStore(store, publicationId);
    if (sha === OLD) await publishSource(target, { ...bucket, sha, local });
    else expect(await reuseSource(target, { ...bucket, sha })).not.toBeNull();
    await closeCommit(store, { sha, publicationId, endedAtMs: 5 });
  }
  const orphan = sourceContentPrefix(
    { ...identity, taskHash: 'fedcba9876543210' },
    source
  );
  await writeUtf8(store, `${orphan}complete.json`, '{}', 'application/json');
  await pruneReports(store);
  expect(await store.listKeys('attempts/run:1/')).not.toEqual([]);
  expect(await store.listKeys('attempts/run:2/')).not.toEqual([]);
  expect(await store.listKeys('attempts/run:3/')).not.toEqual([]);
  expect(await store.listKeys(orphan)).not.toEqual([]);
  expect((await readCommit(store, HEAD))?.state).toBe('complete');
  const ref = { sha: HEAD, source, testId: 'put' };
  expect((await readTestReport(store, ref))?.meta.title).toBe('puts a value');
  const html: string[] = [];
  for await (const event of testEvents(store, ref))
    if (event.type === 'blob' && event.blob.text) html.push(event.blob.text);
  expect(html.join('')).toContain('retained snapshot');
  expect((await pruneReports(store)).deleteKeys).toEqual([]);
});

test('cleanup preserves uploads until a running report can attach their content', async () => {
  const store = new ObjectStoreImplInMemory();
  await openCommit(store, {
    sha: HEAD,
    branch: 'counter',
    publicationId: 'run:3',
    startedAtMs: 3,
    frameCss: '',
    runUrl: null,
  });
  const key = `${sourceContentPrefix(identity, source)}put/snapshots-0.json.gz`;
  await writeUtf8(store, key, 'upload in progress', 'application/gzip');
  await pruneReports(store);
  expect(await store.head(key)).toBe(true);
  await closeCommit(store, { sha: HEAD, publicationId: 'run:3', endedAtMs: 5 });
  await pruneReports(store);
  expect(await store.head(key)).toBe(true);
});
