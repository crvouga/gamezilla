import { expect, test } from 'bun:test';
import type {
  EvidencePage,
  LayerEvidence,
  LayerRows,
} from '@crvouga/atlas/reports/evidence-types';
import { combineEvidence } from '@crvouga/atlas/reports/layer-merge';
import type { ObjectStore } from '@crvouga/atlas/reports/object-store';
import { publicationStore } from '@crvouga/atlas/reports/publication';
import { openCommit, publishSource } from '@crvouga/atlas/reports/publish';
import { testReportKey } from '@crvouga/atlas/reports/recording-keys';
import { publishPart } from '@crvouga/atlas/reports/report-parts';
import type { RunReport } from '@crvouga/atlas/reports/report-types';
import { createReportsApp } from '@crvouga/atlas/reports/reports-route';
import { pruneReports } from '@crvouga/atlas/reports/retention';
import {
  publishInventory,
  specEntry,
} from '@crvouga/atlas/reports/spec-inventory';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

const sha = 'a'.repeat(40);
const path = 'specs/list.feature';

type App = { request: (path: string) => Response | Promise<Response> };

async function page(app: App, cursor?: string): Promise<EvidencePage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return (await (
    await app.request(`/evidence${query}`)
  ).json()) as EvidencePage;
}

/** Each layer of a page with its checks, as the explorer reads them. */
async function evidence(
  app: App,
  layers: EvidencePage['layers']
): Promise<LayerEvidence[]> {
  return Promise.all(
    layers.map(async (layer) => {
      const response = await app.request(
        `/evidence/rows/${layer.backend}/${encodeURIComponent(layer.id)}`
      );
      return { ...((await response.json()) as LayerRows), layer };
    })
  );
}
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
  const layers = (await page(app)).layers.filter(
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
  const result = combineEvidence(
    { specs: [specEntry(path, 'Feature: List')], sha, changedFiles: [] },
    await evidence(app, layers)
  );
  expect(
    result.specs[0]?.results.find((result) => result.row.kind === 'behavior')
      ?.row.status
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
  expect((await app.request('/evidence')).status).toBe(200);
  const cold = reads;
  expect((await app.request('/evidence')).status).toBe(200);
  expect(reads).toBe(cold);
  await publish(store, 2, 'failed');
  time.clock.advance(30_001);
  expect(
    (await page(app)).layers.filter(
      (layer) => layer.recording?.type === 'layer'
    )
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
  for (let i = 0; i < 45; i++)
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
  const first = await page(app);
  expect(first.layers).toHaveLength(40);
  expect(first.cursor).not.toBeNull();
  const next = await page(app, first.cursor!);
  const result = combineEvidence(
    { specs: [specEntry(path, 'Feature: List')], sha, changedFiles: [] },
    await evidence(app, [...first.layers, ...next.layers])
  );
  expect(result.specs[0]!.results).toHaveLength(45);
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
  const combined = combineEvidence(
    { specs: [specEntry(path, 'Feature: List')], sha, changedFiles: [] },
    await evidence(app, (await page(app)).layers)
  );
  const behavior = combined.specs[0]!.results.filter(
    (result) => result.row.kind === 'behavior'
  );
  expect(behavior).toHaveLength(1);
  expect(behavior[0]!.row.status).toBe('passed');
  expect(behavior[0]!.layer.recordedAtMs).toBe(20);
});

test('attempt-isolated publication retains shared spec fingerprints in its layer', async () => {
  // regression: atlas-layer-attempt-inventory
  const store = new ObjectStoreImplInMemory();
  await publish(publicationStore(store, 'attempt'), 1, 'passed');
  const app = createReportsApp({ store, ...createHarnessClock() });
  const layer = (await page(app)).layers.find(
    (layer) => layer.recording?.type === 'layer'
  )!;
  const [recorded] = await evidence(app, [layer]);
  expect(recorded!.fingerprints).toEqual({
    [path]: specEntry(path, 'Feature: List').fingerprint!,
  });
  expect(await store.head(`commits/${sha}/inventory.json`)).toBe(true);
  expect(
    (await app.request(`/layers/${layer.id}/tests/join/report.json`)).status
  ).toBe(200);
});
