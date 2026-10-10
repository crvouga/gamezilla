import { expect, test } from 'bun:test';
import { combineLayers } from '@crvouga/atlas-reports/layer-merge';
import type { LayerPage } from '@crvouga/atlas-reports/layer-types';
import type { ObjectStore } from '@crvouga/atlas-reports/object-store';
import { publicationStore } from '@crvouga/atlas-reports/publication';
import { openCommit, publishSource } from '@crvouga/atlas-reports/publish';
import { testReportKey } from '@crvouga/atlas-reports/recording-keys';
import { publishPart } from '@crvouga/atlas-reports/report-parts';
import type { RunReport } from '@crvouga/atlas-reports/report-types';
import { createReportsApp } from '@crvouga/atlas-reports/reports-route';
import { pruneReports } from '@crvouga/atlas-reports/retention';
import {
  publishInventory,
  specEntry,
} from '@crvouga/atlas-reports/spec-inventory';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';

const sha = 'a'.repeat(40);
const path = 'specs/list.feature';
async function publish(
  store: ObjectStore,
  at: number,
  status: 'passed' | 'failed',
  recordedAtMs?: number
) {
  const local = new ObjectStoreImplInMemory();
  const report: RunReport = {
    meta: {
      runId: 'latest',
      testId: 'join',
      title: 'Join',
      system: 'list',
      runtime: 'memory',
      seed: '1',
      status,
      startedAtMs: at,
      endedAtMs: at,
      durationMs: 0,
      actorIds: [],
      sourceFile: path,
    },
    steps: [],
  };
  await writeUtf8(
    local,
    testReportKey('latest', 'join'),
    JSON.stringify(report)
  );
  await openCommit(store, {
    sha,
    branch: 'example',
    startedAtMs: at,
    frameCss: 'body{}',
    runUrl: null,
  });
  await publishInventory(store, {
    sha,
    documents: [{ path, content: 'Feature: List' }],
  });
  await publishSource(store, {
    sha,
    packageDir: 'example',
    bucket: 'all',
    local,
    parameters: { device: 'phone' },
    ...(recordedAtMs === undefined ? {} : { recordedAtMs }),
  });
}

test('same-commit reruns keep independent immutable layers and lazy recordings after cleanup', async () => {
  const store = new ObjectStoreImplInMemory();
  await publish(store, 1, 'passed');
  await publish(store, 2, 'failed');
  await pruneReports(store);
  const app = createReportsApp({ store, ...createHarnessClock() });
  const page = (await (await app.request('/layers')).json()) as LayerPage;
  const layers = page.layers.filter(
    (layer) => layer.recording?.type === 'layer'
  );
  expect(layers).toHaveLength(2);
  expect(new Set(layers.map((layer) => layer.id)).size).toBe(2);
  for (const layer of layers) {
    const response = await app.request(
      `/layers/${layer.id}/tests/join/report.json`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('immutable');
    const report = (await response.json()) as RunReport;
    expect(report.meta.status).toBe(
      layer.recordedAtMs === 1 ? 'passed' : 'failed'
    );
  }
  const result = combineLayers(
    { specs: [specEntry(path, 'Feature: List')], sha, changedFiles: [] },
    layers
  );
  expect(
    result.specs[0]?.results.find((result) => result.kind === 'behavior')?.check
      .status
  ).toBe('failed');
});

test('warm layer pages avoid repeated object-store reads and discover new publications after virtual time advances', async () => {
  const store = new ObjectStoreImplInMemory();
  await publish(store, 1, 'passed');
  const time = createHarnessClock();
  let reads = 0;
  const original = store.get.bind(store);
  store.get = async (key) => {
    reads++;
    return original(key);
  };
  const app = createReportsApp({ store, ...time });
  expect((await app.request('/layers')).status).toBe(200);
  const cold = reads;
  expect((await app.request('/layers')).status).toBe(200);
  expect(reads).toBe(cold);
  await publish(store, 2, 'failed');
  time.clock.advance(30_001);
  const page = (await (await app.request('/layers')).json()) as LayerPage;
  expect(
    page.layers.filter((layer) => layer.recording?.type === 'layer')
  ).toHaveLength(2);
});

test('current outline is shared by concurrent readers and refreshed after virtual time advances', async () => {
  const time = createHarnessClock();
  let reads = 0;
  const app = createReportsApp({
    ...time,
    store: new ObjectStoreImplInMemory(),
    outline: async () => {
      reads++;
      return {
        sha,
        specs: [specEntry(path, 'Feature: List')],
        changedFiles: [],
        readSpec: async () => 'Feature: List',
      };
    },
  });
  const responses = await Promise.all([
    app.request('/outline'),
    app.request('/outline'),
    app.request(`/outline/spec?path=${path}`),
  ]);
  expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
  expect(reads).toBe(1);
  time.clock.advance(30_001);
  await app.request('/outline');
  expect(reads).toBe(2);
});

test('bounded pages preserve independent producer parameters and origins', async () => {
  const store = new ObjectStoreImplInMemory();
  await openCommit(store, {
    sha,
    branch: 'experiment',
    runUrl: null,
    startedAtMs: 0,
    frameCss: '',
  });
  for (let i = 0; i < 22; i++)
    await publishPart(store, {
      sha,
      id: 'quality',
      kind: 'quality',
      title: 'Quality',
      recordedAtMs: i,
      parameters: { device: String(i) },
      checks: [
        {
          id: 'join',
          title: 'Join',
          status: 'passed',
          detail: '',
          specPath: path,
          measurements: [],
        },
      ],
    });
  const app = createReportsApp({ store, ...createHarnessClock() });
  const first = (await (await app.request('/layers')).json()) as LayerPage;
  expect(first.layers).toHaveLength(20);
  expect(first.cursor).not.toBeNull();
  const next = (await (
    await app.request(`/layers?cursor=${encodeURIComponent(first.cursor!)}`)
  ).json()) as LayerPage;
  const result = combineLayers(
    { specs: [specEntry(path, 'Feature: List')], sha, changedFiles: [] },
    [...first.layers, ...next.layers]
  );
  expect(result.specs[0]!.results).toHaveLength(22);
  expect(
    result.specs[0]!.results.every(
      (result) => result.layer.branch === 'experiment'
    )
  ).toBe(true);
  expect(next.cursor).toBeNull();
});

test('execution completion time orders layers independently of virtual timeline time', async () => {
  // regression: atlas-layer-virtual-time-order
  const store = new ObjectStoreImplInMemory();
  await publish(store, 1, 'failed', 10);
  await publish(store, 1, 'passed', 20);
  const app = createReportsApp({ store, ...createHarnessClock() });
  const page = (await (await app.request('/layers')).json()) as LayerPage;
  const combined = combineLayers(
    { specs: [specEntry(path, 'Feature: List')], sha, changedFiles: [] },
    page.layers
  );
  const behavior = combined.specs[0]!.results.filter(
    (result) => result.kind === 'behavior'
  );
  expect(behavior).toHaveLength(1);
  expect(behavior[0]!.check.status).toBe('passed');
  expect(behavior[0]!.layer.recordedAtMs).toBe(20);
});

test('attempt-isolated publication retains shared spec fingerprints in its layer', async () => {
  // regression: atlas-layer-attempt-inventory
  const store = new ObjectStoreImplInMemory();
  await publish(publicationStore(store, 'attempt'), 1, 'passed');
  const app = createReportsApp({ store, ...createHarnessClock() });
  const page = (await (await app.request('/layers')).json()) as LayerPage;
  const layer = page.layers.find((layer) => layer.recording?.type === 'layer')!;
  expect(layer.specs).toEqual([specEntry(path, 'Feature: List')]);
  expect(await store.head(`commits/${sha}/inventory.json`)).toBe(true);
  expect(
    (await app.request(`/layers/${layer.id}/tests/join/report.json`)).status
  ).toBe(200);
});
