import { expect, test } from 'bun:test';
import type { EvidencePage } from '@crvouga/atlas/reports/evidence-types';
import {
  evidenceFile,
  exportEvidence,
} from '@crvouga/atlas/reports/export-evidence';
import { distinctHeaders } from '@crvouga/atlas/reports/layer-merge';
import {
  closeCommit,
  openCommit,
  publishSource,
  SPEC_RUN_ID,
} from '@crvouga/atlas/reports/publish';
import { createReportsApp } from '@crvouga/atlas/reports/reports-route';
import { publishInventory } from '@crvouga/atlas/reports/spec-inventory';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
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
  await publishSource(store, {
    sha,
    packageDir: 'example',
    bucket: 'behavior',
    local: bucket,
  });
  await closeCommit(store, { sha, endedAtMs: 1 });
  const app = createReportsApp({
    store,
    ...createHarnessClock(),
    outline: async () => ({
      sha,
      changedFiles: [],
      specs: [
        {
          path: 'specs/lists/add.feature',
          title: 'Add an item',
          domain: 'lists',
          kind: 'feature',
        },
      ],
      readSpec: async () => 'Feature: Add an item\n',
    }),
  });
  const exported = await exportEvidence({
    fetch: (path) =>
      Promise.resolve(app.request(`http://atlas/${path.replace(/^\//, '')}`)),
    target: output,
  });
  expect(exported.revisions).toBe(1);
  expect(exported.layers).toBeGreaterThan(0);
  // regression: atlas-layer-snapshot-path
  expect(exported.missing).toEqual([]);
  const page = JSON.parse(
    (await readUtf8(output, evidenceFile('/evidence')))!
  ) as EvidencePage;
  const layers = distinctHeaders(page.layers);
  expect(layers).toHaveLength(1);
  const layer = layers[0]!;
  const base = `/layers/${layer.id}/tests/adds-tea/report.json`;
  expect(await readUtf8(output, evidenceFile(base))).toContain('adds-tea');
  expect(
    await readUtf8(
      output,
      evidenceFile(`/evidence/rows/${layer.backend}/${layer.id}`)
    )
  ).toContain('specs/lists/add.feature');
  expect(
    await readUtf8(
      output,
      evidenceFile('/outline/spec?path=specs%2Flists%2Fadd.feature')
    )
  ).toBe('Feature: Add an item\n');
  expect((await output.listKeys()).some((key) => key.includes('/files/'))).toBe(
    true
  );
  expect(await readUtf8(output, evidenceFile('/evidence'))).toContain(sha);
});
