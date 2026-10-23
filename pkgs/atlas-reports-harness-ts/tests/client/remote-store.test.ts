import { describe, expect, test } from 'bun:test';
import { matchJunitCase, parseJunit } from '@crvouga/atlas/reports/junit';
import type { CommitEvent, TestEvent } from '@crvouga/atlas/reports/protocol';
import {
  closeCommit,
  openCommit,
  publishSource,
  SPEC_RUN_ID,
} from '@crvouga/atlas/reports/publish';
import {
  commitEvents,
  listCommits,
  testEvents,
} from '@crvouga/atlas/reports/read';
import { runManifestKey } from '@crvouga/atlas/reports/recording-keys';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { exampleApp, put } from './example-app';

const SHA = 'a'.repeat(40);
const sys = exampleApp();

/** A package's local bucket after one `bun test` run of `titles`. */
async function localBucket(
  titles: readonly { readonly testId: string; readonly line: number }[]
): Promise<ObjectStoreImplInMemory> {
  const store = new ObjectStoreImplInMemory();
  let elapsed = 0;
  for (const t of titles) {
    await using s = await sys.run({
      seed: 3,
      report: {
        store,
        runId: SPEC_RUN_ID,
        testId: t.testId,
        title: t.testId,
        sourceFile: 'tests/kv.test.ts',
        sourceLine: t.line,
        now: () => 5_000,
        performance: { clock: { now: () => elapsed++ }, slowStepMs: 50 },
      },
    });
    await s.apply(put, 'x', 'hello');
  }
  return store;
}

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const e of events) out.push(e);
  return out;
}

async function open(store: ObjectStoreImplInMemory, startedAtMs = 1_000) {
  await openCommit(store, {
    sha: SHA,
    branch: 'main',
    runUrl: null,
    startedAtMs,
    frameCss: 'body { color: red }',
  });
}

const JUNIT = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="tests/kv.test.ts" file="tests/kv.test.ts" tests="2">
    <testcase name="other case" file="tests/kv.test.ts" line="4" />
    <testcase name="puts a value &amp; checks" file="tests/kv.test.ts" line="10">
      <failure message="expect(received).toBe(expected)"><![CDATA[error: expected 1 to be 2]]></failure>
    </testcase>
  </testsuite>
</testsuites>`;

describe('publish then read a commit', () => {
  test('every source and every frame file comes back', async () => {
    const remote = new ObjectStoreImplInMemory();
    await open(remote);
    const chess = await localBucket([
      { testId: 'kv-put', line: 12 },
      { testId: 'kv-again', line: 20 },
    ]);
    const friends = await localBucket([{ testId: 'kv-put', line: 12 }]);
    await publishSource(remote, {
      sha: SHA,
      packageDir: 'libs/chess',
      bucket: 'part-0',
      local: chess,
    });
    await publishSource(remote, {
      sha: SHA,
      packageDir: 'libs/friends',
      bucket: 'part-1',
      local: friends,
    });
    await closeCommit(remote, { sha: SHA, endedAtMs: 9_000 });

    const { clock, timers } = createHarnessClock();
    const events = await collect<CommitEvent>(
      commitEvents(remote, SHA, {
        clock,
        timers,
        pollMs: 1_000,
        tailMs: 60_000,
      })
    );
    expect(events[0]).toMatchObject({
      type: 'commit',
      commit: { state: 'complete', status: 'passed', endedAtMs: 9_000 },
    });
    const sources = events.flatMap((e) =>
      e.type === 'source' ? [e.source] : []
    );
    expect(sources.map((s) => s.source).sort()).toEqual([
      'libs-chess--part-0',
      'libs-friends--part-1',
    ]);
    expect(
      sources
        .find((s) => s.source === 'libs-chess--part-0')
        ?.tests.map((t) => t.testId)
    ).toEqual(['kv-again', 'kv-put']);
    expect(events.at(-1)).toEqual({ type: 'end', state: 'complete' });

    const test = await collect<TestEvent>(
      testEvents(remote, {
        sha: SHA,
        source: 'libs-chess--part-0',
        testId: 'kv-put',
      })
    );
    expect(test[0]).toMatchObject({
      type: 'report',
      report: {
        meta: {
          performance: { measuredSteps: 1, executionMs: 1, snapshotMs: 1 },
        },
        steps: [{ performance: { selfMs: 1, executionMs: 1, snapshotMs: 1 } }],
      },
    });
    expect(sources[0]?.tests[0]?.performance?.measuredSteps).toBe(1);
    expect(test.at(-1)).toEqual({ type: 'end', found: true });
    const blobs = test.flatMap((e) => (e.type === 'blob' ? [e] : []));
    const html = blobs.find((b) => b.file.endsWith('.html'));
    expect(html?.blob.text).toContain('<!---->hello<!---->');
    const png = blobs.find((b) => b.file.endsWith('.png'));
    expect(png?.blob.base64).toBe(btoa(String.fromCharCode(137, 80, 78, 71)));
  });

  test('a test the manifest lost is still published', async () => {
    // `bun test --parallel` workers read-modify-write one manifest; the
    // report files are the record of what ran.
    const local = await localBucket([{ testId: 'kv-put', line: 12 }]);
    await local.put(
      runManifestKey(SPEC_RUN_ID),
      new TextEncoder().encode(JSON.stringify({ tests: [], updatedAtMs: 0 })),
      'application/json'
    );
    const remote = new ObjectStoreImplInMemory();
    const record = await publishSource(remote, {
      sha: SHA,
      packageDir: 'libs/chess',
      bucket: 'all',
      local,
    });
    expect(record?.tests.map((t) => t.testId)).toEqual(['kv-put']);
  });

  test('test-runner outcomes override the in-run status and title', async () => {
    const cases = parseJunit(JUNIT);
    expect(cases).toHaveLength(2);
    expect(cases[1]?.name).toBe('puts a value & checks');
    expect(matchJunitCase(cases, 'tests/kv.test.ts', 12)?.line).toBe(10);
    expect(matchJunitCase(cases, 'apps/x/tests/kv.test.ts', 5)?.line).toBe(4);

    const local = await localBucket([{ testId: 'kv-put', line: 12 }]);
    await local.put('junit.xml', new TextEncoder().encode(JUNIT), 'text/xml');
    const remote = new ObjectStoreImplInMemory();
    await open(remote);
    const record = await publishSource(remote, {
      sha: SHA,
      packageDir: 'libs/chess',
      bucket: 'all',
      local,
    });
    const meta = record?.tests[0];
    expect(record?.status).toBe('failed');
    expect(meta?.status).toBe('failed');
    expect(meta?.title).toBe('puts a value & checks');
    expect(meta?.error).toContain('expected 1 to be 2');
    const closed = await closeCommit(remote, { sha: SHA, endedAtMs: 2_000 });
    expect(closed.status).toBe('failed');
    const [report] = await collect<TestEvent>(
      testEvents(remote, {
        sha: SHA,
        source: 'libs-chess--all',
        testId: 'kv-put',
      })
    );
    expect(report?.type === 'report' ? report.report.meta.status : null).toBe(
      'failed'
    );
  });

  test('a commit with no report says so', async () => {
    const { clock, timers } = createHarnessClock();
    const events = await collect<CommitEvent>(
      commitEvents(new ObjectStoreImplInMemory(), SHA, {
        clock,
        timers,
        pollMs: 1_000,
        tailMs: 60_000,
      })
    );
    expect(events).toEqual([
      { type: 'commit', commit: null },
      { type: 'end', state: 'missing' },
    ]);
    const test = await collect<TestEvent>(
      testEvents(new ObjectStoreImplInMemory(), {
        sha: SHA,
        source: 'libs-chess--all',
        testId: 'kv-put',
      })
    );
    expect(test).toEqual([{ type: 'end', found: false }]);
  });
});

/** Let the stream run until it waits on the virtual clock. */
async function untilWaiting(pending: () => number): Promise<void> {
  for (let turn = 0; turn < 10_000 && pending() === 0; turn += 1) {
    await Promise.resolve();
  }
  expect(pending()).toBeGreaterThan(0);
}

describe('a running commit', () => {
  test('streams each source as it lands, then ends when the run closes', async () => {
    const remote = new ObjectStoreImplInMemory();
    await open(remote);
    const { clock, timers } = createHarnessClock();
    const seen: CommitEvent[] = [];
    const done = (async () => {
      for await (const e of commitEvents(remote, SHA, {
        clock,
        timers,
        pollMs: 1_000,
        tailMs: 60_000,
      })) {
        seen.push(e);
      }
    })();

    await untilWaiting(() => clock.pendingOneShotCount());
    expect(seen.map((e) => e.type)).toEqual(['commit']);

    await publishSource(remote, {
      sha: SHA,
      packageDir: 'libs/chess',
      bucket: 'part-0',
      local: await localBucket([{ testId: 'kv-put', line: 12 }]),
    });
    clock.advance(1_000);
    await untilWaiting(() => clock.pendingOneShotCount());
    expect(seen.map((e) => e.type)).toEqual(['commit', 'source']);

    await closeCommit(remote, { sha: SHA, endedAtMs: 3_000 });
    clock.advance(1_000);
    await done;
    expect(seen.map((e) => e.type)).toEqual([
      'commit',
      'source',
      'commit',
      'end',
    ]);
    expect(seen.at(-1)).toEqual({ type: 'end', state: 'complete' });
  });

  test('a reconnect never resends the sources the client holds', async () => {
    const remote = new ObjectStoreImplInMemory();
    await open(remote);
    await publishSource(remote, {
      sha: SHA,
      packageDir: 'libs/chess',
      bucket: 'part-0',
      local: await localBucket([{ testId: 'kv-put', line: 12 }]),
    });
    const { clock, timers } = createHarnessClock();
    const done = collect<CommitEvent>(
      commitEvents(remote, SHA, {
        clock,
        timers,
        have: new Set(['libs-chess--part-0']),
        pollMs: 1_000,
        tailMs: 1_500,
      })
    );
    await untilWaiting(() => clock.pendingOneShotCount());
    clock.advance(1_000);
    await untilWaiting(() => clock.pendingOneShotCount());
    clock.advance(1_000);
    const events = await done;
    expect(events.some((e) => e.type === 'source')).toBe(false);
    // Past `tailMs` the stream ends still running; the client reconnects.
    expect(events.at(-1)).toEqual({ type: 'end', state: 'running' });
  });
});

describe('listCommits', () => {
  test('pages through every commit once, newest first, reruns listed once', async () => {
    await assertProperty(
      'pages concatenate to the newest-first unique commits',
      fc.asyncProperty(
        fc.array(
          fc.record({
            sha: fc
              .constantFrom('a', 'b', 'c', 'd', 'e')
              .map((c) => c.repeat(40)),
            at: fc.nat({ max: 1_000_000 }),
          }),
          { maxLength: 12 }
        ),
        fc.integer({ min: 1, max: 4 }),
        async (publishes, limit) => {
          const store = new ObjectStoreImplInMemory();
          const newest = new Map<string, number>();
          for (const p of publishes) {
            await openCommit(store, {
              sha: p.sha,
              branch: 'main',
              runUrl: null,
              startedAtMs: p.at,
              frameCss: '',
            });
            newest.set(p.sha, Math.max(newest.get(p.sha) ?? -1, p.at));
          }
          const listed: string[] = [];
          let cursor: string | null = null;
          for (let page = 0; page < 20; page += 1) {
            const result = await listCommits(store, { limit, cursor });
            expect(result.commits.length).toBeLessThanOrEqual(limit);
            listed.push(...result.commits.map((c) => c.sha));
            cursor = result.cursor;
            if (cursor === null) break;
          }
          expect(cursor).toBeNull();
          expect(new Set(listed).size).toBe(listed.length);
          expect(new Set(listed)).toEqual(new Set(newest.keys()));
        }
      )
    );
  });
});
