import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

import { resolveLocalReportDataDir } from './local-data-dir';
import { createSimulationReportServer } from './server/create-server';
import type { SimulationReportData } from './types';
import { mintRunId, sanitizeTestId } from './types';
import { buildReportUrl, parseReportNav } from './web/router';
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
    const dir = resolveLocalReportDataDir();
    expect(dir.endsWith('/simulation-report-data')).toBe(true);
    expect(existsSync(join(dir, '..', 'turbo.json'))).toBe(true);
  });

  test('ignores package-level turbo.json under apps/', () => {
    const fromApp = resolveLocalReportDataDir(
      join(import.meta.dir, '../../../apps/simulation-report')
    );
    const fromPkg = resolveLocalReportDataDir(import.meta.dir);
    expect(fromApp).toBe(fromPkg);
    expect(fromApp.endsWith('/simulation-report-data')).toBe(true);
    expect(fromApp.includes('/apps/simulation-report/')).toBe(false);
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
      step: null,
      frame: null,
      play: false,
      mode: 'realtime',
      speed: 1,
    });
  });
  test('parses bucket / run / test', () => {
    expect(
      parseReportNav(
        '/b/local/r/20240601T120000/t/auth-login-logout',
        '?step=2&frame=5&play=1&mode=fixed&speed=2'
      )
    ).toEqual({
      bucketId: 'local',
      runId: '20240601T120000',
      testId: 'auth-login-logout',
      step: 2,
      frame: 5,
      play: true,
      mode: 'fixed',
      speed: 2,
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
        step: null,
        frame: null,
        play: false,
        mode: 'realtime',
        speed: 1,
      },
      {
        bucketId: 'local',
        runId: 'run1',
        testId: 'demo',
        frame: 3,
        step: 1,
      }
    );
    expect(url.pathname).toBe('/b/local/r/run1/t/demo');
    expect(url.search).toContain('frame=3');
    expect(url.search).toContain('step=1');
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
  test('lists buckets and serves run APIs', async () => {
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
      distDir: '/tmp/simulation-report-missing-dist',
      now: () => 999,
    });

    const bucketsRes = await server.fetch(new Request('http://x/api/buckets'));
    expect(bucketsRes.status).toBe(200);
    expect(await bucketsRes.json()).toEqual([{ id: 'local', label: 'Local' }]);

    const runsRes = await server.fetch(
      new Request('http://x/api/buckets/local/runs')
    );
    expect(((await runsRes.json()) as { runs: unknown[] }).runs).toHaveLength(
      1
    );

    const testRes = await server.fetch(
      new Request('http://x/api/buckets/local/runs/run1/tests/demo')
    );
    expect(testRes.status).toBe(200);
  });
});
