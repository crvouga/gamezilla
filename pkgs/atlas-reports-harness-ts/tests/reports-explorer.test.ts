import { expect, test } from 'bun:test';
import type { ExplorerData } from '@crvouga/atlas/reports/explorer-types';
import { remoteTestReportKey, sourceKey } from '@crvouga/atlas/reports/keys';
import type {
  CommitEvent,
  CommitPage,
  SourceRecord,
} from '@crvouga/atlas/reports/protocol';
import { SseDecoder } from '@crvouga/atlas/reports/protocol';
import { closeCommit, openCommit } from '@crvouga/atlas/reports/publish';
import { publishPart } from '@crvouga/atlas/reports/report-parts';
import type { RunReport } from '@crvouga/atlas/reports/report-types';
import { createReportsApp } from '@crvouga/atlas/reports/reports-route';
import { publishInventory } from '@crvouga/atlas/reports/spec-inventory';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

const SHA = '1'.repeat(40);

// regression: report-local-version-hidden
test('a remote outage preserves independently recorded local versions', async () => {
  const localStore = new ObjectStoreImplInMemory();
  await publishPart(localStore, {
    sha: SHA,
    id: 'quality',
    kind: 'ui-quality',
    title: 'Quality',
    recordedAtMs: 1,
    checks: [],
  });
  const store = new ObjectStoreImplInMemory();
  store.listKeys = async () => {
    throw new Error('offline');
  };
  const app = createReportsApp({
    store,
    localStore,
    ...createHarnessClock(),
    workspace: async () => ({
      version: { sha: '2'.repeat(40), branch: 'local', dirty: false },
      inventory: { sha: '2'.repeat(40), entries: [] },
      parts: [],
      readSpec: async () => null,
    }),
  });
  const page = (await (await app.request('/')).json()) as CommitPage;
  expect(page.evidenceVersions).toEqual([SHA]);
  expect(page.notice).toContain('could not be reached');
  expect((await app.request(`/${SHA}/explorer`)).status).toBe(200);
});

// regression: report-local-shadows-published
test('local collection preserves other published sources and their timelines', async () => {
  const store = new ObjectStoreImplInMemory();
  const localStore = new ObjectStoreImplInMemory();
  for (const [target, source] of [
    [store, 'counter--ci'],
    [localStore, 'counter--local'],
  ] as const) {
    await openCommit(target, {
      sha: SHA,
      branch: 'example',
      startedAtMs: 0,
      runUrl: null,
      frameCss: '',
    });
    await writeUtf8(
      target,
      sourceKey(SHA, source),
      JSON.stringify({
        source,
        packageDir: 'pkgs/counter',
        bucket: 'all',
        status: 'passed',
        updatedAtMs: 0,
        tests: [],
      })
    );
    await writeUtf8(
      target,
      remoteTestReportKey(SHA, source, 'counter'),
      JSON.stringify({ meta: { title: source }, steps: [] })
    );
    await closeCommit(target, { sha: SHA, endedAtMs: 1 });
  }
  const app = createReportsApp({ store, localStore, ...createHarnessClock() });
  const response = (await (await app.request(`/${SHA}/sources`)).json()) as {
    sources: SourceRecord[];
  };
  expect(
    response.sources.map((source: { source: string }) => source.source).sort()
  ).toEqual(['counter--ci', 'counter--local']);
  for (const source of ['counter--ci', 'counter--local']) {
    const report = (await (
      await app.request(`/${SHA}/tests/${source}/counter`)
    ).json()) as RunReport;
    expect(report.meta.title).toBe(source);
  }
});

// regression: reports-local-empty
test('a checkout without read credentials exposes every spec and explains missing published evidence', async () => {
  const store = new ObjectStoreImplInMemory();
  const inventory = await publishInventory(store, {
    sha: SHA,
    documents: [
      { path: 'specs/example/counter.feature', content: 'Feature: Counter\n' },
    ],
  });
  const app = createReportsApp({
    store: null,
    ...createHarnessClock(),
    workspace: async () => ({
      version: { sha: SHA, branch: 'example', dirty: true },
      inventory,
      parts: [],
      readSpec: async () => 'Feature: Counter\n',
    }),
  });
  const page = (await (await app.request('/')).json()) as CommitPage;
  expect(page.workspace?.sha).toBe(SHA);
  expect(page.notice).toContain('no reports read credential');
  expect(
    ((await (await app.request(`/${SHA}/explorer`)).json()) as ExplorerData)
      .inventory
  ).toEqual(inventory);
  expect(
    await (
      await app.request(`/${SHA}/spec?path=specs/example/counter.feature`)
    ).text()
  ).toBe('Feature: Counter\n');
  expect(
    (await app.request(`/${SHA}/spec?path=specs/../../secret`)).status
  ).toBe(404);
});

test('collected local timelines remain readable without a remote store', async () => {
  const localStore = new ObjectStoreImplInMemory();
  await openCommit(localStore, {
    sha: SHA,
    branch: 'local',
    startedAtMs: 10,
    runUrl: null,
    frameCss: 'body{}',
  });
  await closeCommit(localStore, { sha: SHA, endedAtMs: 20 });
  const app = createReportsApp({
    store: null,
    localStore,
    ...createHarnessClock(),
  });
  expect((await app.request(`/${SHA}`)).status).toBe(200);
  expect(await (await app.request(`/${SHA}/frame.css`)).text()).toBe('body{}');
  const events = new SseDecoder<CommitEvent>().push(
    await (await app.request(`/${SHA}/events`)).text()
  );
  expect(events.at(-1)).toEqual({ type: 'end', state: 'complete' });
});

test('a standalone producer is discoverable before any test run exists', async () => {
  const store = new ObjectStoreImplInMemory();
  await publishPart(store, {
    sha: SHA,
    id: 'quality',
    title: 'Quality',
    kind: 'ui-quality',
    recordedAtMs: 10,
    checks: [],
  });
  const app = createReportsApp({ store, ...createHarnessClock() });
  expect(
    ((await (await app.request('/')).json()) as CommitPage).evidenceVersions
  ).toEqual([SHA]);
  expect(
    ((await (await app.request(`/${SHA}/explorer`)).json()) as ExplorerData)
      .parts
  ).toHaveLength(1);
});
