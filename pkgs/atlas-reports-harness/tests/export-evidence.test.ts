import { expect, test } from 'bun:test';
import {
  evidenceFile,
  exportEvidence,
} from '@crvouga/atlas-reports/export-evidence';
import {
  closeCommit,
  openCommit,
  publishSource,
  SPEC_RUN_ID,
} from '@crvouga/atlas-reports/publish';
import { createReportsApp } from '@crvouga/atlas-reports/reports-route';
import { publishInventory } from '@crvouga/atlas-reports/spec-inventory';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { readUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { exampleApp, put } from './client/example-app';

test('static Atlas export preserves revision specs, outcomes, timeline and snapshots', async () => {
  const sha = 'a'.repeat(40);
  const store = new ObjectStoreImplInMemory();
  const output = new ObjectStoreImplInMemory();
  const bucket = new ObjectStoreImplInMemory();
  {
    await using session = await exampleApp().run({
      seed: 3,
      report: {
        store: bucket,
        runId: SPEC_RUN_ID,
        testId: 'adds-tea',
        sourceFile: 'specs/lists/add.feature',
      },
    });
    await session.apply(put, 'item', 'Tea');
  }
  await publishInventory(store, {
    sha,
    documents: [
      { path: 'specs/lists/add.feature', content: 'Feature: Add an item\n' },
    ],
  });
  await openCommit(store, {
    sha,
    branch: 'example',
    runUrl: null,
    startedAtMs: 0,
    frameCss: 'body { color: black }',
  });
  const source = await publishSource(store, {
    sha,
    packageDir: 'example',
    bucket: 'behavior',
    local: bucket,
  });
  await closeCommit(store, { sha, endedAtMs: 1 });
  const app = createReportsApp({ store, ...createHarnessClock() });
  const exported = await exportEvidence({
    fetch: (path) =>
      Promise.resolve(app.request(`http://atlas/${path.replace(/^\//, '')}`)),
    target: output,
  });
  expect(exported).toEqual({ revisions: 1, missing: [] });
  const base = `/${sha}/tests/${source!.source}/adds-tea`;
  expect(await readUtf8(output, evidenceFile(base))).toContain('adds-tea');
  expect(
    await readUtf8(
      output,
      evidenceFile(`/${sha}/spec?path=specs%2Flists%2Fadd.feature`)
    )
  ).toBe('Feature: Add an item\n');
  expect((await output.listKeys()).some((key) => key.includes('/files/'))).toBe(
    true
  );
  expect(await readUtf8(output, 'index.json')).toContain(sha);
});
