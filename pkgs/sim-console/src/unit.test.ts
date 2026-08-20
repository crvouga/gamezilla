import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { wallTimers } from '@pkgs/clock';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { buildReportUrl, parseReportNav } from './client/router';
import { resolveLocalReportDataDir } from './local-data-dir';
import { createSimulationReportServer } from './server/create-server';
import type { SimulationReportData } from './types';
import {
  isLatestRunId,
  LATEST_RUN_ID,
  mintRunId,
  sanitizeRunId,
  sanitizeTestId,
} from './types';
import { wallPathExists } from './wall-path-exists';
import { testStepsKey } from './writer/keys';
import { deleteRun, pruneRuns } from './writer/prune';
import { hashString, SimulationReporter } from './writer/reporter';
import {
  loadRunManifest,
  loadRunsIndex,
  storeGetJson,
} from './writer/store-io';

describe('resolveLocalReportDataDir', () => {
  test('resolves under monorepo root', () => {
    const dir = resolveLocalReportDataDir(process.cwd(), wallPathExists);
    expect(dir.endsWith('/.cache/sim-console-data')).toBe(true);
    expect(existsSync(join(dir, '../..', 'turbo.json'))).toBe(true);
  });

  test('ignores package-level turbo.json under apps/', () => {
    const fromApp = resolveLocalReportDataDir(
      join(import.meta.dir, '../../../pkgs/sim-console'),
      wallPathExists
    );
    const fromPkg = resolveLocalReportDataDir(import.meta.dir, wallPathExists);
    expect(fromApp).toBe(fromPkg);
    expect(fromApp.endsWith('/.cache/sim-console-data')).toBe(true);
    expect(fromApp.includes('/pkgs/sim-console/')).toBe(false);
  });
});

describe('sanitizeTestId', () => {
  test('keeps safe ids', () => {
    expect(sanitizeTestId('auth-login-logout')).toBe('auth-login-logout');
  });
  test('strips junk', () => {
    expect(sanitizeTestId(' a/b ')).toBe('a_b');
  });
});

describe('mintRunId', () => {
  test('formats UTC stamp', () => {
    expect(mintRunId(Date.UTC(2024, 5, 1, 12, 30, 45))).toBe('20240601T123045');
  });
});

describe('hashString', () => {
  test('is stable', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});

describe('parseReportNav', () => {
  test('parses bucket picker', () => {
    expect(parseReportNav('/', '')).toEqual({
      bucketId: null,
      runId: null,
      testId: null,
      frame: null,
      node: null,
      view: null,
    });
  });
  test('parses bucket / run / test', () => {
    expect(
      parseReportNav(
        '/b/local/r/20240601T120000/t/auth-login-logout',
        '?frame=5&node=alice&view=sqlite'
      )
    ).toEqual({
      bucketId: 'local',
      runId: '20240601T120000',
      testId: 'auth-login-logout',
      frame: 5,
      node: 'alice',
      view: 'db',
    });
  });
});

describe('buildReportUrl', () => {
  test('builds nested path', () => {
    const url = buildReportUrl(
      {
        bucketId: null,
        runId: null,
        testId: null,
        frame: null,
        node: null,
        view: null,
      },
      {
        bucketId: 'local',
        runId: 'run1',
        testId: 'demo',
        frame: 3,
        node: 'bob',
        view: 'ui',
      }
    );
    expect(url.pathname).toBe('/b/local/r/run1/t/demo');
    expect(url.search).toContain('frame=3');
    expect(url.search).toContain('node=bob');
    expect(url.search).toContain('view=ui');
    expect(url.search).not.toContain('step=');
  });
});

describe('storeGetJson', () => {
  test('returns null for missing, empty, or invalid JSON', async () => {
    const store = new ObjectStoreImplInMemory();
    expect(await storeGetJson(store, 'missing.json')).toBeNull();
    await store.put('empty.json', new Uint8Array(), 'application/json');
    expect(await storeGetJson(store, 'empty.json')).toBeNull();
    await store.put(
      'bad.json',
      new TextEncoder().encode('{'),
      'application/json'
    );
    expect(await storeGetJson(store, 'bad.json')).toBeNull();
    await store.put(
      'ok.json',
      new TextEncoder().encode('{"runs":[]}'),
      'application/json'
    );
    expect(
      await storeGetJson<{ runs: readonly unknown[] }>(store, 'ok.json')
    ).toEqual({ runs: [] });
  });
});

describe('SimulationReporter + ObjectStore', () => {
  test('writes steps, run manifest, and runs index', async () => {
    const store = new ObjectStoreImplInMemory();
    const reporter = new SimulationReporter({
      seed: '1',
      ui: 'in-process',
      store,
      runId: 'run-a',
      testId: 'test-one',
      now: () => 1000,
    });
    await reporter.record({
      actorId: 'alice',
      kind: 'tap',
      title: 'tap button',
      run: async () => undefined,
      snapshot: async () => '<html>frame-a</html>',
    });
    const data = await reporter.flush();
    expect(data.meta.runId).toBe('run-a');
    expect(data.meta.testId).toBe('test-one');
    expect(data.steps).toHaveLength(1);

    const steps = await storeGetJson<SimulationReportData>(
      store,
      testStepsKey('run-a', 'test-one')
    );
    expect(steps?.steps[0]?.frames?.length).toBeGreaterThan(0);

    const manifest = await loadRunManifest(store, 'run-a');
    expect(manifest.tests.map((t) => t.testId)).toEqual(['test-one']);

    const second = new SimulationReporter({
      seed: '1',
      ui: 'in-process',
      store,
      runId: 'run-a',
      testId: 'test-two',
      now: () => 2000,
    });
    await second.record({
      actorId: 'bob',
      kind: 'step',
      title: 'named',
      run: async () => undefined,
      snapshot: async () => '<html>frame-b</html>',
      pollFrames: false,
    });
    await second.flush();

    const manifest2 = await loadRunManifest(store, 'run-a');
    expect(manifest2.tests.map((t) => t.testId).sort()).toEqual([
      'test-one',
      'test-two',
    ]);
    const index = await loadRunsIndex(store);
    expect(index.runs).toHaveLength(1);
    expect(index.runs[0]?.id).toBe('run-a');
    expect(index.runs[0]?.testCount).toBe(2);
  });

  test('attaches gzip SQLite dumps with content-hash reuse', async () => {
    const store = new ObjectStoreImplInMemory();
    const payload = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65]);
    let calls = 0;
    const reporter = new SimulationReporter({
      seed: '1',
      ui: 'in-process',
      store,
      runId: 'run-db',
      testId: 'db-test',
      now: (() => {
        let t = 1000;
        return () => {
          t += 1;
          return t;
        };
      })(),
      snapshotDatabases: async () => {
        calls += 1;
        return [
          { nodeId: 'api', bytes: payload },
          { nodeId: 'alice', bytes: payload },
        ];
      },
      snapshotCheckpoint: () => ({
        clockMs: 42,
        clockPaused: false,
        clientIds: ['alice'],
        roomTopics: [],
        partitions: [],
        skewByAddress: {},
        downAddresses: [],
        evictedAddresses: [],
      }),
    });
    await reporter.record({
      actorId: 'alice',
      kind: 'tap',
      title: 'first',
      run: async () => undefined,
      snapshot: async () => '<html>one</html>',
    });
    await reporter.record({
      actorId: 'alice',
      kind: 'tap',
      title: 'second',
      run: async () => undefined,
      snapshot: async () => '<html>two</html>',
    });
    const data = await reporter.flush();
    expect(calls).toBe(2);
    const frame0 = data.steps[0]?.frames?.[0];
    const frame1 = data.steps[1]?.frames?.[0];
    expect(frame0?.databases?.map((d) => d.nodeId).sort()).toEqual([
      'alice',
      'api',
    ]);
    expect(frame0?.databases?.[0]?.file).toMatch(
      /^frames\/db\/[a-f0-9]{64}\.sqlite\.gz$/
    );
    // Identical bytes → same content-addressed blob across frames/nodes.
    const files = new Set(
      [...(frame0?.databases ?? []), ...(frame1?.databases ?? [])].map(
        (d) => d.file
      )
    );
    expect(files.size).toBe(1);
    const rel = frame0!.databases![0]!.file;
    const obj = await store.get(`runs/run-db/tests/db-test/${rel}`);
    expect(obj).not.toBeNull();
    expect(obj?.contentType).toBe('application/gzip');
    expect(frame0?.checkpoint?.clientIds).toEqual(['alice']);
    expect(frame0?.checkpoint?.file).toMatch(
      /^frames\/f-\d+\.checkpoint\.json$/
    );
  });

  test('writes per-actor HTML views and primary file', async () => {
    const store = new ObjectStoreImplInMemory();
    const reporter = new SimulationReporter({
      seed: '1',
      ui: 'in-process',
      store,
      runId: 'run-views',
      testId: 'views-test',
      now: (() => {
        let t = 1000;
        return () => {
          t += 1;
          return t;
        };
      })(),
      snapshotViews: async () => [
        { nodeId: 'alice', html: '<html>alice</html>' },
        { nodeId: 'bob', html: '<html>bob</html>' },
      ],
    });
    await reporter.record({
      actorId: 'bob',
      kind: 'tap',
      title: 'tap bob',
      run: async () => undefined,
      snapshot: async () => '<html>legacy</html>',
    });
    const data = await reporter.flush();
    const frame = data.steps[0]?.frames?.[0];
    expect(frame?.views?.map((v) => v.nodeId).sort()).toEqual(['alice', 'bob']);
    expect(frame?.file).toBe('frames/f-00001.bob.html');
    const bob = await store.get(
      'runs/run-views/tests/views-test/frames/f-00001.bob.html'
    );
    const alice = await store.get(
      'runs/run-views/tests/views-test/frames/f-00001.alice.html'
    );
    expect(bob).not.toBeNull();
    expect(alice).not.toBeNull();
    expect(await new Response(bob!.body).text()).toContain('bob');
    expect(await new Response(alice!.body).text()).toContain('alice');
  });
});

describe('prune', () => {
  test('deleteRun removes frames and index entry', async () => {
    const store = new ObjectStoreImplInMemory();
    const reporter = new SimulationReporter({
      seed: '1',
      ui: 'in-process',
      store,
      runId: 'old-run',
      testId: 't1',
      now: () => 100,
    });
    await reporter.record({
      actorId: 'a',
      kind: 'tap',
      title: 'x',
      run: async () => undefined,
      snapshot: async () => '<html>z</html>',
    });
    await reporter.flush();
    expect((await loadRunsIndex(store)).runs).toHaveLength(1);
    await deleteRun(store, 'old-run');
    expect((await loadRunsIndex(store)).runs).toHaveLength(0);
    expect(await store.head(testStepsKey('old-run', 't1'))).toBe(false);
  });

  test('keepLast prunes older runs', async () => {
    const store = new ObjectStoreImplInMemory();
    for (const [id, t] of [
      ['r1', 100],
      ['r2', 200],
      ['r3', 300],
    ] as const) {
      const r = new SimulationReporter({
        seed: '1',
        ui: 'in-process',
        store,
        runId: id,
        testId: 't',
        now: () => t,
      });
      await r.record({
        actorId: 'a',
        kind: 'tap',
        title: 'x',
        run: async () => undefined,
        snapshot: async () => `<html>${id}</html>`,
      });
      await r.flush();
    }
    const deleted = await pruneRuns(store, { keepLast: 1, nowMs: 300 });
    expect([...deleted].sort()).toEqual(['r1', 'r2']);
    const index = await loadRunsIndex(store);
    expect(index.runs.map((r) => r.id)).toEqual(['r3']);
  });
});

describe('createSimulationReportServer', () => {
  test('health + SSE events stream runs/manifest/test', async () => {
    const store = new ObjectStoreImplInMemory();
    const reporter = new SimulationReporter({
      seed: '1',
      ui: 'in-process',
      store,
      runId: 'run1',
      testId: 'demo',
      now: () => 1,
    });
    await reporter.record({
      actorId: 'a',
      kind: 'tap',
      title: 'x',
      run: async () => undefined,
      snapshot: async () => '<html>hi</html>',
    });
    await reporter.flush();

    const server = createSimulationReportServer({
      buckets: [{ id: 'local', label: 'Local', store }],
      timers: wallTimers,
      now: () => 999,
    });

    const health = await server.fetch(new Request('http://x/api/health'));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, bucketCount: 1 });

    const eventsRes = await server.fetch(
      new Request('http://x/api/buckets/local/events?run=latest&test=demo')
    );
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.headers.get('content-type') ?? '').toContain(
      'text/event-stream'
    );
    const reader = eventsRes.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (let i = 0; i < 20; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.includes('event: test')) break;
    }
    await reader.cancel();
    expect(text).toContain('event: runs');
    expect(text).toContain('run1');
    expect(text).toContain('event: manifest');
    expect(text).toContain('event: test');
    server.stop();
  });
});

describe('LATEST_RUN_ID', () => {
  test('sanitizeRunId remaps reserved latest', () => {
    expect(isLatestRunId(LATEST_RUN_ID)).toBe(true);
    expect(sanitizeRunId('latest')).toBe('latest_run');
  });
  test('parses /r/latest', () => {
    expect(parseReportNav('/b/local/r/latest', '')).toMatchObject({
      bucketId: 'local',
      runId: 'latest',
    });
  });
});

describe('projectReportTopology', () => {
  test('maps sim topology into report JSON', async () => {
    const { projectReportTopology } = await import('./writer/project-topology');
    const report = projectReportTopology(
      {
        nodes: [
          { id: 'server', kind: 'server', down: true },
          { id: 'alice', kind: 'client', down: false },
          { id: 'events', kind: 'events', down: false },
        ],
        edges: [
          {
            from: 'alice',
            to: 'server',
            kind: 'server',
            partitioned: true,
          },
          {
            from: 'server',
            to: 'events',
            kind: 'events',
            partitioned: false,
          },
        ],
      },
      'seed-1'
    );

    expect(report.seed).toBe('seed-1');
    expect(report.fuzz).toBeNull();
    expect(report.nodes.find((n) => n.id === 'server')).toMatchObject({
      status: 'down',
      attributes: ['sqlite', 'ingress', 'egress'],
      clockSkewMs: 0,
    });
    expect(report.nodes.find((n) => n.id === 'alice')).toMatchObject({
      status: 'ok',
      attributes: ['html', 'sqlite', 'ingress', 'egress'],
    });
    expect(
      report.edges.find((e) => e.from === 'alice' && e.to === 'server')
    ).toMatchObject({
      state: 'down',
      latencyMs: 0,
      dropRate: 0,
    });
    expect(
      report.edges.find((e) => e.from === 'server' && e.to === 'events')
    ).toMatchObject({ state: 'up' });
    expect(report.definition.kinds['client']?.attributes).toContain('html');
    expect(report.definition.spawn['client']?.edges).toEqual([
      { to: 'server', kind: 'server' },
    ]);
  });
});
