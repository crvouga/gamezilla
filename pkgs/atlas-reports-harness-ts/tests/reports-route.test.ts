import { describe, expect, test } from 'bun:test';
import {
  commitIndexKey,
  commitKey,
  frameCssKey,
  remoteTestFileKey,
  remoteTestReportKey,
  sourceKey,
} from '@crvouga/atlas/reports/keys';
import type {
  CommitEvent,
  CommitRecord,
  SourceRecord,
} from '@crvouga/atlas/reports/protocol';
import { SseDecoder } from '@crvouga/atlas/reports/protocol';
import { publicationStore } from '@crvouga/atlas/reports/publication';
import {
  closeCommit,
  openCommit,
  publishSource,
} from '@crvouga/atlas/reports/publish';
import type { RunReport } from '@crvouga/atlas/reports/report-types';
import { createReportsApp } from '@crvouga/atlas/reports/reports-route';
import { reuseSource } from '@crvouga/atlas/reports/source-content';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

const SHA = 'c'.repeat(40);

const COMMIT: CommitRecord = {
  sha: SHA,
  branch: 'main',
  runUrl: null,
  state: 'complete',
  startedAtMs: 1_000,
  endedAtMs: 2_000,
  status: 'passed',
};

const SOURCE: SourceRecord = {
  source: 'libs-chess--part-0',
  packageDir: 'libs/chess',
  bucket: 'part-0',
  status: 'passed',
  updatedAtMs: 1_500,
  tests: [],
};

async function seeded(): Promise<ObjectStoreImplInMemory> {
  const store = new ObjectStoreImplInMemory();
  await writeUtf8(store, commitKey(SHA), JSON.stringify(COMMIT));
  await writeUtf8(store, commitIndexKey(SHA, COMMIT.startedAtMs), '{}');
  await writeUtf8(store, sourceKey(SHA, SOURCE.source), JSON.stringify(SOURCE));
  await writeUtf8(store, frameCssKey(SHA), 'body{}', 'text/css; charset=utf-8');
  return store;
}

function app(store: ObjectStoreImplInMemory | null) {
  const { clock, timers } = createHarnessClock();
  return createReportsApp({ store, clock, timers });
}

describe('reports API', () => {
  // regression: report-rerun-immutable-cache
  test('serves reused source records and the selected attempt stylesheet without caching a prior attempt', async () => {
    const store = await seeded();
    const identity = { taskHash: '0123456789abcdef', generation: 0 };
    await publishSource(store, {
      sha: SHA,
      packageDir: SOURCE.packageDir,
      bucket: SOURCE.bucket,
      local: new ObjectStoreImplInMemory(),
      identity,
      status: 'passed',
    });
    await openCommit(store, {
      ...COMMIT,
      frameCss: 'body{color:red}',
      publicationId: 'new:1',
    });
    const source = await reuseSource(publicationStore(store, 'new:1'), {
      sha: SHA,
      packageDir: SOURCE.packageDir,
      bucket: SOURCE.bucket,
      identity,
    });
    await closeCommit(store, {
      sha: SHA,
      publicationId: 'new:1',
      endedAtMs: 3000,
    });
    const reports = app(store);
    const sources = await reports.request(`/${SHA}/sources`);
    expect(sources.headers.get('cache-control')).toBe('no-store');
    expect(await (await reports.request(`/${SHA}/sources`)).json()).toEqual({
      sources: [source],
    });
    expect(await (await reports.request(`/${SHA}/frame.css`)).text()).toBe(
      'body{color:red}'
    );
  });
  test('lists commits newest first', async () => {
    const res = await app(await seeded()).request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ commits: [COMMIT], cursor: null });
  });

  test('streams a commit as server-sent events', async () => {
    const res = await app(await seeded()).request(`/${SHA}/events`);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const events = new SseDecoder<CommitEvent>().push(await res.text());
    expect(events).toEqual([
      { type: 'commit', commit: COMMIT },
      { type: 'source', source: SOURCE },
      { type: 'end', state: 'complete' },
    ]);
  });

  test('serves the stylesheet the snapshots render with', async () => {
    const res = await app(await seeded()).request(`/${SHA}/frame.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
    expect(await res.text()).toBe('body{}');
  });

  test('answers 404 for anything but a full sha, source and test id', async () => {
    const reports = app(await seeded());
    expect((await reports.request('/main')).status).toBe(404);
    expect((await reports.request(`/${'d'.repeat(40)}`)).status).toBe(404);
    expect(
      (await reports.request(`/${SHA}/tests/..%2F..%2Fcommit.json/x/events`))
        .status
    ).toBe(404);
    expect(
      (await reports.request(`/${SHA}/tests/libs-chess--part-0/..%2F/events`))
        .status
    ).toBe(404);
  });

  test('answers 503 when this deployment holds no credential', async () => {
    const reports = app(null);
    expect((await reports.request('/')).status).toBe(503);
    expect((await reports.request(`/${SHA}/events`)).status).toBe(503);
  });

  test('serves sources, one timeline and one frame from the selected attempt', async () => {
    const store = await seeded();
    const report = {
      meta: {
        system: 'chess',
        runtime: 'sim',
        seed: '1',
        startedAtMs: 1,
        endedAtMs: 2,
        durationMs: 12,
        status: 'passed',
        runId: 'run',
        testId: 'kv-put',
        title: 'puts a value',
        actorIds: ['alice'],
      },
      steps: [],
    };
    await writeUtf8(
      store,
      remoteTestReportKey(SHA, SOURCE.source, 'kv-put'),
      JSON.stringify(report)
    );
    await writeUtf8(
      store,
      remoteTestFileKey(SHA, SOURCE.source, 'kv-put', 'frames/f-0001.html'),
      '<html>hello</html>',
      'text/html; charset=utf-8'
    );
    const reports = app(store);
    const sources = await reports.request(`/${SHA}/sources`);
    expect(sources.status).toBe(200);
    expect(sources.headers.get('cache-control')).toBe('no-store');
    expect(await sources.json()).toEqual({ sources: [SOURCE] });

    const timeline = await reports.request(
      `/${SHA}/tests/${SOURCE.source}/kv-put`
    );
    expect(timeline.headers.get('cache-control')).toBe('no-store');
    expect(((await timeline.json()) as RunReport).meta.testId).toBe('kv-put');

    const file = await reports.request(
      `/${SHA}/tests/${SOURCE.source}/kv-put/files/frames/f-0001.html`
    );
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toContain('text/html');
    expect(file.headers.get('cache-control')).toBe('no-store');
    expect(await file.text()).toBe('<html>hello</html>');
  });

  test('a bad sha or a frame path that leaves the test is not found', async () => {
    const reports = app(await seeded());
    expect((await reports.request('/not-a-sha/sources')).status).toBe(404);
    expect(
      (
        await reports.request(
          `/${SHA}/tests/${SOURCE.source}/kv-put/files/..%2F..%2Fcommit.json`
        )
      ).status
    ).toBe(404);
  });

  test('a running commit is not cached', async () => {
    const store = await seeded();
    await writeUtf8(
      store,
      commitKey(SHA),
      JSON.stringify({
        ...COMMIT,
        state: 'running',
        endedAtMs: null,
        status: null,
      })
    );
    const res = await app(store).request(`/${SHA}/sources`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('a browser on another origin may read it', async () => {
    // regression: atlas-report-cors
    const res = await app(await seeded()).request('/', {
      headers: { origin: 'https://app.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://app.example'
    );
  });
});
