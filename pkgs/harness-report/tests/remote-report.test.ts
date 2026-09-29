import { describe, expect, test } from 'bun:test';
import {
  createHarnessClock,
  type HarnessClock,
  type Timers,
} from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createRoot } from 'solid-js';

import {
  type CommitEvent,
  commitEvents,
  encodeSseEvent,
  frameCssKey,
  isKeySegment,
  type TestEvent,
  testEvents,
} from '../src/index';
import {
  closeCommit,
  openCommit,
  publishSource,
  SPEC_RUN_ID,
} from '../src/remote/publish';
import {
  createRemoteReport,
  type RemoteReport,
} from '../src/remote/remote-report';
import { exampleApp, put } from './example-app/example-app';

const SHA = 'e'.repeat(40);
const API = 'https://api.test/api/reports';
const TEST_ID = 'libs-chess--part-0/kv-put';
const sys = exampleApp();

function sse(events: AsyncGenerator<CommitEvent | TestEvent>): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = await events.next();
        if (next.done === true) controller.close();
        else controller.enqueue(encoder.encode(encodeSseEvent(next.value)));
      },
    })
  );
}

/** The reports API over `store`, in process, with the server's own clock. */
function fakeApi(
  store: ObjectStoreImplInMemory,
  server: { clock: HarnessClock; timers: Timers }
): HttpClient & { readonly requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    async fetch(input) {
      const url = new URL(String(input));
      requests.push(`${url.pathname}${url.search}`);
      const rest = url.pathname.slice(`/api/reports/${SHA}`.length);
      if (rest === '/events') {
        const have = (url.searchParams.get('have') ?? '')
          .split(',')
          .filter(isKeySegment);
        return sse(
          commitEvents(store, SHA, {
            ...server,
            have: new Set(have),
            pollMs: 1_000,
            tailMs: 1_500,
          })
        );
      }
      if (rest === '/frame.css') {
        const css = await store.get(frameCssKey(SHA));
        return new Response(css?.body ?? null, { status: css ? 200 : 404 });
      }
      const m = /^\/tests\/([^/]+)\/([^/]+)\/events$/.exec(rest);
      if (m?.[1] !== undefined && m[2] !== undefined) {
        return sse(testEvents(store, { sha: SHA, source: m[1], testId: m[2] }));
      }
      return new Response(null, { status: 404 });
    },
  };
}

async function publishChess(store: ObjectStoreImplInMemory): Promise<void> {
  const local = new ObjectStoreImplInMemory();
  {
    await using s = await sys.run({
      seed: 3,
      report: {
        store: local,
        runId: SPEC_RUN_ID,
        testId: 'kv-put',
        title: 'puts a value',
        sourceFile: 'tests/kv.test.ts',
        now: () => 5_000,
      },
    });
    await s.apply(put, 'x', 'hello');
  }
  await publishSource(store, {
    sha: SHA,
    packageDir: 'libs/chess',
    bucket: 'part-0',
    local,
  });
}

async function openRun(store: ObjectStoreImplInMemory): Promise<void> {
  await openCommit(store, {
    sha: SHA,
    branch: 'feature-x',
    runUrl: null,
    startedAtMs: 1_000,
    frameCss: 'body{}',
  });
}

/** Let streams run until `ready` holds (in-process: promise turns only). */
async function until(ready: () => boolean): Promise<void> {
  for (let turn = 0; turn < 20_000 && !ready(); turn += 1) {
    await Promise.resolve();
  }
  expect(ready()).toBe(true);
}

function open(http: HttpClient): { report: RemoteReport; dispose: () => void } {
  const { timers } = createHarnessClock();
  return createRoot((dispose) => {
    const report = createRemoteReport({ http, timers, apiBase: API, sha: SHA });
    return {
      report,
      dispose: () => {
        report.dispose();
        dispose();
      },
    };
  });
}

describe('a streamed report', () => {
  test('lists every test, then loads one with its frames on first view', async () => {
    const store = new ObjectStoreImplInMemory();
    await openRun(store);
    await publishChess(store);
    await closeCommit(store, { sha: SHA, endedAtMs: 9_000 });
    const { report, dispose } = open(fakeApi(store, createHarnessClock()));

    await until(() => report.phase() === 'complete');
    expect(report.data.tests.map((t) => t.report.meta.testId)).toEqual([
      TEST_ID,
    ]);
    expect(report.data.runId).toContain('feature-x');
    expect(report.data.tests[0]?.report.steps).toEqual([]);

    report.loader.load(TEST_ID);
    await until(() => report.loader.state(TEST_ID).kind === 'ready');
    const test = report.data.tests[0];
    expect(test?.report.steps.length).toBeGreaterThan(0);
    expect(
      Object.entries(test?.blobs ?? {}).find(([file]) =>
        file.endsWith('.html')
      )?.[1].text
    ).toContain('hello');
    expect(report.frameCss()).toBe('body{}');
    expect(report.loader.state('libs-chess--part-0/nope').kind).toBe('missing');
    dispose();
  });

  test('a running commit fills in as it publishes, and a reconnect never duplicates', async () => {
    const store = new ObjectStoreImplInMemory();
    await openRun(store);
    await publishChess(store);
    const server = createHarnessClock();
    const api = fakeApi(store, server);
    const { report, dispose } = open(api);

    await until(() => report.data.tests.length === 1);
    expect(report.phase()).toBe('live');

    // Past the server's tail the stream ends `running`; the client resumes,
    // naming the source it already holds.
    await until(() => server.clock.pendingOneShotCount() > 0);
    server.clock.advance(1_000);
    await until(() => server.clock.pendingOneShotCount() > 0);
    server.clock.advance(1_000);
    await until(() =>
      api.requests.some((r) => r.includes('have=libs-chess--part-0'))
    );

    await closeCommit(store, { sha: SHA, endedAtMs: 9_000 });
    await until(() => server.clock.pendingOneShotCount() > 0);
    server.clock.advance(1_000);
    await until(() => report.phase() === 'complete');
    expect(report.data.tests).toHaveLength(1);
    expect(report.commit()?.state).toBe('complete');
    dispose();
  });

  test('a commit with no report says so', async () => {
    const store = new ObjectStoreImplInMemory();
    const { report, dispose } = open(fakeApi(store, createHarnessClock()));
    await until(() => report.phase() === 'missing');
    expect(report.data.tests).toEqual([]);
    expect(report.loader.state(TEST_ID).kind).toBe('missing');
    dispose();
  });
});
