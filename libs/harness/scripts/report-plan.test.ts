import { expect, test } from 'bun:test';
import { readCommit } from '@pkgs/harness-report';
import { openCommit, publishSource } from '@pkgs/harness-report/remote/publish';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import {
  createReportPlan,
  finishReport,
  reusePlannedReports,
  taskIdentity,
} from './report-plan';
import { verifyPublications } from './report-task-publish';

const SHA = 'a'.repeat(40);
const cached = {
  taskId: '@libs/example#test:spec:0',
  hash: '0123456789abcdef',
  hit: true,
};
const missing = { ...cached, taskId: '@libs/example#test:spec:1' };
const failed = { ...cached, taskId: '@libs/example#test:spec:2', hit: false };

test('only exact passing cache hits with complete published content bypass restoring outputs', async () => {
  const store = new ObjectStoreImplInMemory();
  const plan = createReportPlan([cached, missing, failed], 0, 30);
  await publishSource(store, {
    sha: SHA,
    packageDir: 'libs/example',
    bucket: 'part-0',
    local: new ObjectStoreImplInMemory(),
    status: 'passed',
    identity: taskIdentity(plan, cached.taskId),
  });
  await publishSource(store, {
    sha: SHA,
    packageDir: 'libs/example',
    bucket: 'part-2',
    local: new ObjectStoreImplInMemory(),
    status: 'passed',
    identity: taskIdentity(plan, failed.taskId),
  });
  expect(
    await reusePlannedReports({ store, sha: SHA, runId: 'run:1', plan })
  ).toEqual([missing.taskId, failed.taskId].sort());
  await verifyPublications({
    store,
    sha: SHA,
    runId: 'run:1',
    tasks: [cached],
  });
  await expect(
    verifyPublications({ store, sha: SHA, runId: 'run:1', tasks: [missing] })
  ).rejects.toThrow();
});

test('task identities must belong to the exact plan', () => {
  expect(() =>
    taskIdentity(createReportPlan([cached], 0, 30), 'not-planned')
  ).toThrow();
});

test('a missing report closes the attempt red and rejects the gate', async () => {
  const store = new ObjectStoreImplInMemory();
  await openCommit(store, {
    sha: SHA,
    branch: 'example',
    runUrl: null,
    startedAtMs: 0,
    frameCss: '',
    publicationId: 'run:1',
  });
  await expect(
    finishReport({
      store,
      sha: SHA,
      runId: 'run:1',
      endedAtMs: 1,
      failed: false,
      plan: createReportPlan([missing], 0, 30),
    })
  ).rejects.toThrow('Report not published');
  expect(await readCommit(store, SHA)).toMatchObject({
    state: 'complete',
    status: 'failed',
  });
});
