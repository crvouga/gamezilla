import { describe, expect, test } from 'bun:test';
import { createReportsApp } from '@libs/server-app/reports/route';
import { createHarnessClock } from '@pkgs/clock';
import {
  type CommitEvent,
  type CommitRecord,
  commitIndexKey,
  commitKey,
  frameCssKey,
  type SourceRecord,
  SseDecoder,
  sourceKey,
} from '@pkgs/harness-report';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

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

  test('a browser on another origin may read it', async () => {
    const res = await app(await seeded()).request('/', {
      headers: { origin: 'https://gamezilla.app' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://gamezilla.app'
    );
  });
});
