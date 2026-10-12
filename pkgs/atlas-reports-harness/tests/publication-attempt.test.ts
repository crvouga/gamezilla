import { expect, test } from 'bun:test';
import { publicationStore } from '@crvouga/atlas/reports/publication';
import {
  closeCommit,
  openCommit,
  publishSource,
} from '@crvouga/atlas/reports/publish';
import {
  listSourceRecords,
  readCommit,
  readFrameCss,
} from '@crvouga/atlas/reports/read';
import { readBytes } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';

const SHA = 'a'.repeat(40);
const opening = {
  sha: SHA,
  branch: 'example',
  runUrl: null,
  frameCss: 'first',
  startedAtMs: 0,
};

// regression: report-concurrent-attempt-overwrite
test('a late close and failed upload from an earlier attempt cannot overwrite the selected attempt', async () => {
  const store = new ObjectStoreImplInMemory();
  await openCommit(store, { ...opening, publicationId: 'run:1' });
  await openCommit(store, {
    ...opening,
    frameCss: 'second',
    startedAtMs: 10,
    publicationId: 'run:2',
  });
  await publishSource(publicationStore(store, 'run:1'), {
    sha: SHA,
    packageDir: 'libs/example',
    bucket: 'part-0',
    local: new ObjectStoreImplInMemory(),
    status: 'failed',
  });
  await closeCommit(store, {
    sha: SHA,
    publicationId: 'run:1',
    endedAtMs: 20,
    status: 'failed',
  });
  expect(await readCommit(store, SHA)).toMatchObject({
    state: 'running',
    startedAtMs: 10,
    status: null,
  });
  expect(await listSourceRecords(store, SHA)).toEqual([]);
  const css = await readFrameCss(store, SHA);
  expect(new TextDecoder().decode(await readBytes(css!.body))).toBe('second');
  await closeCommit(store, { sha: SHA, publicationId: 'run:2', endedAtMs: 30 });
  expect(await readCommit(store, SHA)).toMatchObject({
    state: 'complete',
    status: 'skipped',
    endedAtMs: 30,
  });
});

test('publication scopes reject traversal', () => {
  expect(() =>
    publicationStore(new ObjectStoreImplInMemory(), '../other')
  ).toThrow();
});
