import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { resolveLocalReportDataDir } from '@pkgs/simulation-report';

import { Simulation } from '../open-simulation';
import { DemoSimulationSystem } from './fixtures/demo-system';

describe('Simulation (demo system)', () => {
  test('two actors share state and assert only via UI', async () => {
    const sim = await Simulation.open({
      seed: 1,
      system: new DemoSimulationSystem(),
    });
    try {
      expect(sim.ui).toBe('in-process');
      expect(sim.seed).toBe(1n);

      const alice = await sim.actor('alice');
      await alice.ui.expect.visible('demo-root');
      await alice.ui.expect.text('actor-id', 'alice');
      await alice.ui.expect.text('shared-title', '(empty)');

      await alice.ui.tap('create');
      await alice.ui.expect.text('shared-title', 'Game night (alice)');

      const bob = await sim.actor('bob');
      await bob.ui.expect.visible('demo-root');
      await bob.ui.expect.text('actor-id', 'bob');
      await bob.ui.expect.text('shared-title', 'Game night (alice)');
    } finally {
      await sim.dispose();
    }
  });

  test('actor() returns the same instance for the same id', async () => {
    const sim = await Simulation.open({
      seed: 'demo',
      system: new DemoSimulationSystem(),
    });
    try {
      const a1 = await sim.actor('alice');
      const a2 = await sim.actor('alice');
      expect(a1).toBe(a2);
    } finally {
      await sim.dispose();
    }
  });

  test('clock advances deterministically', async () => {
    const sim = await Simulation.open({
      seed: 42,
      startMs: 1000,
      system: new DemoSimulationSystem(),
    });
    try {
      expect(sim.clock.now()).toBe(1000);
      sim.clock.advance(250);
      expect(sim.clock.now()).toBe(1250);
    } finally {
      await sim.dispose();
    }
  });

  test('report writes suite data artifacts (no SPA copy)', async () => {
    const rootDir = join(resolveLocalReportDataDir(), 'demo-report-test');
    const runId = 'demo-run';
    const testId = 'demo-report';
    const store = createNodeFsObjectStore({ rootDir });
    const sim = await Simulation.open({
      seed: 7,
      system: new DemoSimulationSystem(),
      report: { store, runId, testId },
    });
    try {
      const alice = await sim.actor('alice');
      await alice.ui.tap('create');
      await alice.ui.expect.text('shared-title', 'Game night (alice)');
    } finally {
      await sim.dispose();
    }

    const stepsKey = `runs/${runId}/tests/${testId}/steps.json`;
    expect(sim.reportPath).toBe(stepsKey);
    const stepsPath = join(rootDir, ...stepsKey.split('/'));
    const runDir = join(rootDir, 'runs', runId);
    expect(existsSync(stepsPath)).toBe(true);
    expect(existsSync(join(rootDir, 'runs', 'index.json'))).toBe(true);
    expect(existsSync(join(runDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(runDir, 'snapshot-shell.css'))).toBe(true);

    const manifest = JSON.parse(
      readFileSync(join(runDir, 'manifest.json'), 'utf8')
    ) as { tests: Array<{ testId: string; path: string }> };
    expect(manifest.tests.some((t) => t.testId === testId)).toBe(true);
    expect(manifest.tests.find((t) => t.testId === testId)?.path).toBe(
      `/t/${testId}`
    );

    const stepsJson = JSON.parse(readFileSync(stepsPath, 'utf8')) as {
      meta: { testId: string; runId: string };
      steps: Array<{
        kind: string;
        snapshotFile?: string;
        frames?: Array<{ file: string }>;
      }>;
    };
    expect(stepsJson.meta.testId).toBe(testId);
    expect(stepsJson.meta.runId).toBe(runId);
    expect(stepsJson.steps.some((s) => s.kind === 'launch')).toBe(true);
    expect(stepsJson.steps.some((s) => s.kind === 'tap')).toBe(true);
    const tapStep = stepsJson.steps.find((s) => s.kind === 'tap');
    expect(tapStep?.snapshotFile).toMatch(/^frames\/f-\d+\.[^/]+\.html$/);
    expect(tapStep?.frames?.length).toBeGreaterThan(0);
    const snap = readFileSync(
      join(runDir, 'tests', testId, tapStep!.snapshotFile!),
      'utf8'
    );
    expect(snap).toContain('Game night (alice)');
    expect(snap).toContain('snapshot-shell.css');
  });
});
